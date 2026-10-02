import React from 'react';
import { Box, Button, Typography, Container, Paper } from '@mui/material';
import CloudQueueIcon from '@mui/material/Icon';

export default function Login() {
  const handleLogin = () => {
    window.location.href = 'http://localhost:3000/auth/login';
  };

  return (
    <Box 
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d1117 0%, #1a202c 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Abstract Background Shapes */}
      <Box sx={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,161,224,0.1) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
      <Box sx={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,161,224,0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
      
      <Container maxWidth="sm" sx={{ zIndex: 1, position: 'relative' }}>
        <Paper
          elevation={24}
          sx={{
            p: 6,
            borderRadius: 4,
            textAlign: 'center',
            background: 'rgba(22, 27, 34, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
          }}
        >
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" alt="Salesforce" height="80" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))' }} />
          </Box>
          <Typography variant="h4" component="h1" gutterBottom fontWeight={700} sx={{ color: '#fff', mb: 2 }}>
            Next-Gen CRM Interface
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 5, lineHeight: 1.6 }}>
            Seamlessly manage your Accounts, Opportunities, Leads, Contacts, and Cases with a fast, modern, and beautiful interface.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleLogin}
            sx={{
              py: 1.5,
              px: 4,
              fontSize: '1.1rem',
              borderRadius: '30px',
              boxShadow: '0 4px 14px 0 rgba(0,161,224,0.39)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(0,161,224,0.4)',
                backgroundColor: '#008bbf'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Connect with Salesforce
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
