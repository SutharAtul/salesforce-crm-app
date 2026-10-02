import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, Typography, Paper, Container, Button, IconButton, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  CircularProgress, Fade, Skeleton
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business'; // Account
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'; // Opportunity
import PersonAddIcon from '@mui/icons-material/PersonAdd'; // Lead
import ContactsIcon from '@mui/icons-material/Contacts'; // Contact
import SupportAgentIcon from '@mui/icons-material/SupportAgent'; // Case
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import api from '../api';

const OBJECTS = [
  { name: 'Account', icon: <BusinessIcon /> },
  { name: 'Opportunity', icon: <AttachMoneyIcon /> },
  { name: 'Lead', icon: <PersonAddIcon /> },
  { name: 'Contact', icon: <ContactsIcon /> },
  { name: 'Case', icon: <SupportAgentIcon /> }
];

const drawerWidth = 260;

export default function Dashboard() {
  const [selectedObject, setSelectedObject] = useState('Account');
  const [metadata, setMetadata] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});

  const observer = useRef();
  
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setOffset(prev => prev + 20);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Load Metadata when object changes
  useEffect(() => {
    const fetchMetadata = async () => {
      setInitialLoading(true);
      try {
        const res = await api.get(`/metadata/${selectedObject}`);
        setMetadata(res.data);
        setRecords([]);
        setOffset(0);
        setHasMore(true);
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    };
    fetchMetadata();
  }, [selectedObject]);

  // Load Records when object or offset changes
  useEffect(() => {
    if (metadata.length === 0) return;
    
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/records/${selectedObject}?limit=20&offset=${offset}`);
        const newRecords = res.data.records;
        if (newRecords.length < 20) {
          setHasMore(false);
        }
        
        setRecords(prev => {
          // Prevent duplicates by ensuring we only append unique IDs
          const existingIds = new Set(prev.map(r => r.Id));
          const uniqueNewRecords = newRecords.filter(r => !existingIds.has(r.Id));
          return offset === 0 ? newRecords : [...prev, ...uniqueNewRecords];
        });
      } catch (err) {
        console.error("Failed to fetch records", err);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };
    fetchRecords();
  }, [selectedObject, offset, metadata]);

  const handleCreate = () => {
    setEditingRecord(null);
    setFormData({});
    setModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({ ...record });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Are you sure you want to delete this record?')) {
      try {
        await api.delete(`/records/${selectedObject}/${id}`);
        setRecords(prev => prev.filter(r => r.Id !== id));
      } catch (err) {
        console.error("Failed to delete", err);
      }
    }
  };

  const handleSave = async () => {
    try {
      if (editingRecord) {
        const dataToUpdate = { ...formData };
        delete dataToUpdate.Id;
        delete dataToUpdate.attributes;
        await api.put(`/records/${selectedObject}/${editingRecord.Id}`, dataToUpdate);
        setRecords(prev => prev.map(r => r.Id === editingRecord.Id ? { ...r, ...dataToUpdate } : r));
      } else {
        const res = await api.post(`/records/${selectedObject}`, formData);
        setRecords([{ Id: res.data.id, ...formData }, ...records]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save", err);
      alert('Error saving record. Please check required fields.');
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0d1117' }}>
      
      {/* Sidebar Navigation */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#161b22',
            borderRight: '1px solid #30363d',
            color: '#c9d1d9'
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" alt="Salesforce" height="30" />
          <Typography variant="h6" fontWeight={700} sx={{ color: '#fff' }}>
            CRM Next
          </Typography>
        </Box>
        <List sx={{ px: 2 }}>
          {OBJECTS.map((obj) => (
            <ListItem key={obj.name} disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                selected={selectedObject === obj.name}
                onClick={() => setSelectedObject(obj.name)}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(0, 161, 224, 0.15)',
                    color: '#00a1e0',
                    '&:hover': { bgcolor: 'rgba(0, 161, 224, 0.2)' }
                  },
                  '&:hover': { bgcolor: '#21262d' }
                }}
              >
                <ListItemIcon sx={{ color: selectedObject === obj.name ? '#00a1e0' : '#8b949e', minWidth: 40 }}>
                  {obj.icon}
                </ListItemIcon>
                <ListItemText primary={obj.name} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, width: `calc(100% - ${drawerWidth}px)`, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Fade in timeout={500}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexShrink: 0 }}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#fff', mb: 1 }}>
                {selectedObject}s
              </Typography>
              <Typography variant="body1" sx={{ color: '#8b949e' }}>
                Manage and track all your {selectedObject.toLowerCase()} records efficiently.
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={handleCreate}
              sx={{ 
                borderRadius: '24px', 
                px: 3, 
                py: 1.2,
                boxShadow: '0 8px 16px rgba(0,161,224,0.3)',
                background: 'linear-gradient(135deg, #00a1e0 0%, #008bbf 100%)'
              }}
            >
              New {selectedObject}
            </Button>
          </Box>
        </Fade>

        {initialLoading ? (
          <Paper elevation={0} sx={{ bgcolor: '#161b22', borderRadius: 3, p: 3, border: '1px solid #30363d' }}>
            <Skeleton variant="text" width="100%" height={60} sx={{ bgcolor: '#21262d' }} />
            <Skeleton variant="rectangular" width="100%" height={400} sx={{ bgcolor: '#21262d', borderRadius: 2, mt: 2 }} />
          </Paper>
        ) : (
          <Fade in timeout={800}>
            <TableContainer 
              component={Paper} 
              sx={{ 
                bgcolor: '#161b22', 
                borderRadius: 3, 
                border: '1px solid #30363d',
                flexGrow: 1,
                boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
                '&::-webkit-scrollbar': { width: '10px', height: '10px' },
                '&::-webkit-scrollbar-thumb': { background: '#30363d', borderRadius: '5px' }
              }}
            >
              <Table stickyHeader sx={{ minWidth: 1200 }}>
                <TableHead>
                  <TableRow>
                    {metadata.map(field => (
                      <TableCell 
                        key={field.name} 
                        sx={{ 
                          bgcolor: 'rgba(22, 27, 34, 0.95)', 
                          color: '#8b949e', 
                          fontWeight: 700, 
                          borderBottom: '1px solid #30363d',
                          backdropFilter: 'blur(8px)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {field.label}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ bgcolor: 'rgba(22, 27, 34, 0.95)', color: '#8b949e', fontWeight: 700, borderBottom: '1px solid #30363d', backdropFilter: 'blur(8px)' }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((row, index) => {
                    const isLastElement = records.length === index + 1;
                    return (
                      <TableRow 
                        ref={isLastElement ? lastElementRef : null} 
                        key={row.Id}
                        hover
                        sx={{ 
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.03) !important' },
                          '& td': { borderBottom: '1px solid #21262d', color: '#c9d1d9', py: 2 }
                        }}
                      >
                        {metadata.map(field => (
                          <TableCell key={field.name}>
                            {row[field.name] || '—'}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEdit(row)} sx={{ color: '#00a1e0', mr: 1, '&:hover': { bgcolor: 'rgba(0,161,224,0.1)' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(row.Id)} sx={{ color: '#f08080', '&:hover': { bgcolor: 'rgba(240,128,128,0.1)' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {loading && !initialLoading && (
                    <TableRow>
                      <TableCell colSpan={metadata.length + 1} align="center" sx={{ py: 4, borderBottom: 'none' }}>
                        <CircularProgress size={30} sx={{ color: '#00a1e0' }} />
                        <Typography variant="body2" sx={{ color: '#8b949e', mt: 1 }}>Loading more records...</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Fade>
        )}
      </Box>

      {/* Create / Edit Modal */}
      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        maxWidth="sm" 
        fullWidth 
        PaperProps={{ 
          sx: { 
            bgcolor: '#161b22', 
            color: '#fff', 
            borderRadius: 3, 
            border: '1px solid #30363d',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {editingRecord ? `Edit ${selectedObject}` : `Create New ${selectedObject}`}
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#30363d', py: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {metadata.filter(f => f.type !== 'id').map(field => (
              <TextField
                key={field.name}
                label={field.label}
                variant="outlined"
                fullWidth
                size="small"
                InputLabelProps={{ style: { color: '#8b949e' } }}
                InputProps={{ style: { color: '#c9d1d9' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#30363d' },
                    '&:hover fieldset': { borderColor: '#8b949e' },
                    '&.Mui-focused fieldset': { borderColor: '#00a1e0' }
                  }
                }}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderColor: '#30363d' }}>
          <Button onClick={() => setModalOpen(false)} sx={{ color: '#8b949e', fontWeight: 600 }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            sx={{ 
              borderRadius: '20px', 
              px: 3, 
              background: 'linear-gradient(135deg, #00a1e0 0%, #008bbf 100%)',
              fontWeight: 600
            }}
          >
            Save {selectedObject}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
