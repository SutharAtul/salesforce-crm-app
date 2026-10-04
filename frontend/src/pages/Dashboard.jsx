import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, Tooltip, Chip, InputBase,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  CircularProgress, Skeleton, Snackbar, Alert, useMediaQuery,
  ThemeProvider, createTheme, CssBaseline
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ContactsIcon from '@mui/icons-material/Contacts';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuIcon from '@mui/icons-material/Menu';
import InboxIcon from '@mui/icons-material/InboxOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/* ---------- Tokens ---------- */
const C = {
  bg: '#0a0e14',
  surface: '#111720',
  raised: '#18202b',
  line: '#232d3a',
  text: '#e6edf3',
  muted: '#8794a4',
  brand: '#00a1e0',
  danger: '#ff7b72'
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: C.brand },
    background: { default: C.bg, paper: C.surface },
    text: { primary: C.text, secondary: C.muted },
    divider: C.line
  },
  shape: { borderRadius: 10 },
  typography: {
    // Add <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"> to index.html
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 }
  }
});

const OBJECTS = [
  { name: 'Account', plural: 'Accounts', icon: <BusinessIcon fontSize="small" /> },
  { name: 'Opportunity', plural: 'Opportunities', icon: <AttachMoneyIcon fontSize="small" /> },
  { name: 'Lead', plural: 'Leads', icon: <PersonAddIcon fontSize="small" /> },
  { name: 'Contact', plural: 'Contacts', icon: <ContactsIcon fontSize="small" /> },
  { name: 'Case', plural: 'Cases', icon: <SupportAgentIcon fontSize="small" /> }
];

const PAGE_SIZE = 20;
const drawerWidth = 240;
const SHOW_ID_COLUMN = false; // set true to show the Salesforce Id column

/* ---------- Cell rendering ---------- */
const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: C.muted }}>—</span>;
  }
  if (typeof value === 'boolean') {
    return <Chip size="small" label={value ? 'Yes' : 'No'} color={value ? 'primary' : 'default'} variant="outlined" />;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const cellSx = {
  maxWidth: 260,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${C.line}`,
  py: 1.5,
  fontSize: 14
};

const headCellSx = {
  bgcolor: C.surface,
  color: C.muted,
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${C.line}`,
  py: 1.5
};

export default function Dashboard() {
  const isDesktop = useMediaQuery('(min-width:900px)');
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('sf_token');
    navigate('/');
  };

  const [selectedObject, setSelectedObject] = useState('Account');
  const [metadata, setMetadata] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null); // { severity, message }

  const current = OBJECTS.find(o => o.name === selectedObject);
  const metaReady = metadata.length > 0;

  const visibleFields = useMemo(
    () => metadata.filter(f => SHOW_ID_COLUMN || f.type !== 'id'),
    [metadata]
  );

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      visibleFields.some(f => String(r[f.name] ?? '').toLowerCase().includes(q))
    );
  }, [records, search, visibleFields]);

  /* Reset everything synchronously when switching objects (avoids stale offset / old rows) */
  const selectObject = (name) => {
    if (name === selectedObject) { setNavOpen(false); return; }
    setMetadata([]);
    setRecords([]);
    setOffset(0);
    setHasMore(true);
    setSearch('');
    setInitialLoading(true);
    setSelectedObject(name);
    setNavOpen(false);
  };

  const refresh = () => {
    setRecords([]);
    setOffset(0);
    setHasMore(true);
    setInitialLoading(true);
    setReloadKey(k => k + 1);
  };

  /* Infinite scroll sentinel */
  const observer = useRef();
  const sentinelRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    if (!node || loading || !hasMore) return;
    observer.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setOffset(prev => prev + PAGE_SIZE); },
      { rootMargin: '200px' }
    );
    observer.current.observe(node);
  }, [loading, hasMore]);

  /* Metadata */
  useEffect(() => {
    let cancelled = false;
    api.get(`/metadata/${selectedObject}`)
      .then(res => { if (!cancelled) setMetadata(res.data); })
      .catch(err => {
        console.error('Failed to load metadata', err);
        if (!cancelled) {
          setInitialLoading(false);
          setToast({ severity: 'error', message: `Couldn't load ${selectedObject} fields. Try refreshing.` });
        }
      });
    return () => { cancelled = true; };
  }, [selectedObject]);

  /* Records */
  useEffect(() => {
    if (!metaReady) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/records/${selectedObject}?limit=${PAGE_SIZE}&offset=${offset}`)
      .then(res => {
        if (cancelled) return;
        const incoming = res.data.records;
        if (incoming.length < PAGE_SIZE) setHasMore(false);
        setRecords(prev => {
          if (offset === 0) return incoming;
          const seen = new Set(prev.map(r => r.Id));
          return [...prev, ...incoming.filter(r => !seen.has(r.Id))];
        });
      })
      .catch(err => {
        console.error('Failed to fetch records', err);
        if (!cancelled) {
          setHasMore(false);
          setToast({ severity: 'error', message: `Couldn't load ${selectedObject} records.` });
        }
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); setInitialLoading(false); }
      });
    return () => { cancelled = true; };
  }, [selectedObject, offset, metaReady, reloadKey]);

  /* Actions */
  const handleCreate = () => { setEditingRecord(null); setFormData({}); setModalOpen(true); };
  const handleEdit = (record) => { setEditingRecord(record); setFormData({ ...record }); setModalOpen(true); };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/records/${selectedObject}/${target.Id}`);
      setRecords(prev => prev.filter(r => r.Id !== target.Id));
      setToast({ severity: 'success', message: `${selectedObject} deleted` });
    } catch (err) {
      console.error('Failed to delete', err);
      setToast({ severity: 'error', message: `Couldn't delete this ${selectedObject.toLowerCase()}.` });
    }
  };

  const handleSave = async () => {
    try {
      if (editingRecord) {
        const dataToUpdate = { ...formData };
        delete dataToUpdate.Id;
        delete dataToUpdate.attributes;
        await api.put(`/records/${selectedObject}/${editingRecord.Id}`, dataToUpdate);
        setRecords(prev => prev.map(r => (r.Id === editingRecord.Id ? { ...r, ...dataToUpdate } : r)));
        setToast({ severity: 'success', message: `${selectedObject} saved` });
      } else {
        const res = await api.post(`/records/${selectedObject}`, formData);
        setRecords(prev => [{ Id: res.data.id, ...formData }, ...prev]);
        setToast({ severity: 'success', message: `${selectedObject} created` });
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save', err);
      setToast({ severity: 'error', message: 'Couldn\'t save. Check the required fields and try again.' });
    }
  };

  /* ---------- Sidebar ---------- */
  const sidebar = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" alt="Salesforce" height="26" />
        <Typography fontWeight={700} fontSize={17}>CRM Next</Typography>
      </Box>
      <List sx={{ px: 1.5, flexGrow: 1 }}>
        {OBJECTS.map(obj => {
          const active = selectedObject === obj.name;
          return (
            <ListItem key={obj.name} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={active}
                onClick={() => selectObject(obj.name)}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  borderLeft: '3px solid transparent',
                  '&.Mui-selected': {
                    bgcolor: 'rgba(0,161,224,0.12)',
                    borderLeftColor: C.brand,
                    color: C.brand,
                    '&:hover': { bgcolor: 'rgba(0,161,224,0.18)' }
                  },
                  '&:hover': { bgcolor: C.raised }
                }}
              >
                <ListItemIcon sx={{ color: active ? C.brand : C.muted, minWidth: 36 }}>{obj.icon}</ListItemIcon>
                <ListItemText primary={obj.plural} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ p: 2, borderTop: `1px solid ${C.line}` }}>
        <Button 
          fullWidth 
          variant="text" 
          startIcon={<LogoutIcon />} 
          onClick={handleLogout}
          sx={{ 
            justifyContent: 'flex-start', 
            color: C.muted, 
            px: 2,
            py: 1,
            borderRadius: 2,
            '&:hover': { color: C.text, bgcolor: C.raised } 
          }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  /* ---------- Table body states ---------- */
  const renderBody = () => {
    if (initialLoading) {
      return (
        <Box sx={{ p: 3 }}>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 1.25, bgcolor: C.raised }} />
          ))}
        </Box>
      );
    }
    if (filteredRecords.length === 0) {
      return (
        <Box sx={{ py: 10, textAlign: 'center', color: C.muted }}>
          <InboxIcon sx={{ fontSize: 44, mb: 1, opacity: 0.6 }} />
          <Typography fontWeight={600} color="text.primary">
            {search ? 'No matching records' : `No ${current.plural.toLowerCase()} yet`}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {search ? 'Try a different search term.' : `Create your first ${selectedObject.toLowerCase()} to get started.`}
          </Typography>
          {!search && <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>New {selectedObject}</Button>}
        </Box>
      );
    }
    return (
      <Table stickyHeader sx={{ width: 'max-content', minWidth: '100%' }}>
        <TableHead>
          <TableRow>
            {visibleFields.map((field, i) => (
              <TableCell
                key={field.name}
                sx={{
                  ...headCellSx,
                  ...(i === 0 && { position: 'sticky', left: 0, zIndex: 3, pl: 3 })
                }}
              >
                {field.label}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ ...headCellSx, position: 'sticky', right: 0, zIndex: 3, pr: 3 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredRecords.map(row => (
            <TableRow
              key={row.Id}
              sx={{
                '& td': { bgcolor: C.surface },
                '&:hover td': { bgcolor: C.raised },
                '&:hover .row-actions': { opacity: 1 },
                '&:last-child td': { borderBottom: 0 }
              }}
            >
              {visibleFields.map((field, i) => {
                const raw = row[field.name];
                const text = typeof raw === 'string' ? raw : undefined;
                const content = formatValue(raw);
                return (
                  <TableCell
                    key={field.name}
                    sx={{
                      ...cellSx,
                      ...(i === 0 && {
                        position: 'sticky', left: 0, zIndex: 1, pl: 3, fontWeight: 600,
                        borderRight: `1px solid ${C.line}`
                      })
                    }}
                  >
                    {text && text.length > 28
                      ? <Tooltip title={text} placement="top-start" enterDelay={400}><span>{content}</span></Tooltip>
                      : content}
                  </TableCell>
                );
              })}
              <TableCell align="right" sx={{ ...cellSx, position: 'sticky', right: 0, zIndex: 1, pr: 2, borderLeft: `1px solid ${C.line}` }}>
                <Box className="row-actions" sx={{ opacity: { xs: 1, md: 0.45 }, transition: 'opacity .15s', whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit">
                    <IconButton size="small" aria-label="Edit" onClick={() => handleEdit(row)} sx={{ color: C.brand }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" aria-label="Delete" onClick={() => setDeleteTarget(row)} sx={{ color: C.danger }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', bgcolor: C.bg, overflow: 'hidden' }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop || navOpen}
          onClose={() => setNavOpen(false)}
          sx={{
            width: isDesktop ? drawerWidth : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: drawerWidth, bgcolor: C.surface, borderRight: `1px solid ${C.line}`, backgroundImage: 'none' }
          }}
        >
          {sidebar}
        </Drawer>

        {/* Main: fills all remaining width, left-aligned */}
        <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', p: { xs: 2, md: 3 }, textAlign: 'left' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
            {!isDesktop && (
              <IconButton onClick={() => setNavOpen(true)} aria-label="Open navigation"><MenuIcon /></IconButton>
            )}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h5" fontWeight={700} letterSpacing="-0.01em">{current.plural}</Typography>
              <Typography variant="body2" color="text.secondary">
                {initialLoading ? 'Loading…' : `${records.length}${hasMore ? '+' : ''} records loaded`}
              </Typography>
            </Box>

            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, height: 40, width: { xs: '100%', sm: 280 },
              bgcolor: C.surface, border: `1px solid ${C.line}`, borderRadius: 2,
              '&:focus-within': { borderColor: C.brand }
            }}>
              <SearchIcon fontSize="small" sx={{ color: C.muted }} />
              <InputBase
                placeholder={`Search ${current.plural.toLowerCase()}`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                inputProps={{ 'aria-label': 'Search loaded records' }}
                sx={{ flex: 1, fontSize: 14 }}
              />
            </Box>
            <Tooltip title="Refresh">
              <IconButton onClick={refresh} aria-label="Refresh" sx={{ border: `1px solid ${C.line}`, borderRadius: 2, height: 40, width: 40 }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate} sx={{ height: 40, px: 2.5, boxShadow: 'none' }}>
              New {selectedObject}
            </Button>
          </Box>

          {/* Table card */}
          <Paper elevation={0} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${C.line}`, bgcolor: C.surface, overflow: 'hidden' }}>
            <TableContainer
              sx={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                '&::-webkit-scrollbar': { width: 10, height: 10 },
                '&::-webkit-scrollbar-thumb': { background: C.line, borderRadius: 5 }
              }}
            >
              {renderBody()}
              {!initialLoading && (
                <Box ref={sentinelRef} sx={{ py: 2, textAlign: 'center', minHeight: 56, position: 'sticky', left: 0 }}>
                  {loading
                    ? <CircularProgress size={22} />
                    : !hasMore && records.length > 0 && (
                      <Typography variant="caption" color="text.secondary">You've reached the end</Typography>
                    )}
                </Box>
              )}
            </TableContainer>
          </Paper>
        </Box>

        {/* Create / Edit */}
        <Dialog
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { bgcolor: C.surface, backgroundImage: 'none', border: `1px solid ${C.line}` } }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            {editingRecord ? `Edit ${selectedObject}` : `New ${selectedObject}`}
          </DialogTitle>
          <DialogContent dividers sx={{ borderColor: C.line }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, pt: 1 }}>
              {metadata.filter(f => f.type !== 'id').map(field => {
                const isLong = field.type === 'textarea';
                const isDate = field.type === 'date';
                return (
                  <TextField
                    key={field.name}
                    label={field.label}
                    size="small"
                    fullWidth
                    multiline={isLong}
                    minRows={isLong ? 3 : undefined}
                    type={isDate ? 'date' : 'text'}
                    InputLabelProps={isDate ? { shrink: true } : undefined}
                    sx={{
                      gridColumn: isLong ? '1 / -1' : 'auto',
                      '& .MuiOutlinedInput-root fieldset': { borderColor: C.line }
                    }}
                    value={formData[field.name] ?? ''}
                    onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                  />
                );
              })}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setModalOpen(false)} color="inherit">Cancel</Button>
            <Button variant="contained" onClick={handleSave} sx={{ boxShadow: 'none' }}>Save changes</Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          PaperProps={{ sx: { bgcolor: C.surface, backgroundImage: 'none', border: `1px solid ${C.line}` } }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Delete this {selectedObject.toLowerCase()}?</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              {deleteTarget && (deleteTarget[visibleFields[0]?.name] || deleteTarget.Id)} will be removed. This can't be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setDeleteTarget(null)} color="inherit">Cancel</Button>
            <Button variant="contained" color="error" onClick={confirmDelete} sx={{ boxShadow: 'none' }}>Delete</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          {toast ? <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
