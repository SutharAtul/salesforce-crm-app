const express = require('express');
const cors = require('cors');
const jsforce = require('jsforce');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Stores
const tokenStore = new Map();
const pkceStore = new Map();

const oauth2 = new jsforce.OAuth2({
  clientId: process.env.SALESFORCE_CLIENT_ID,
  clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
  redirectUri: process.env.SALESFORCE_CALLBACK_URL
});

function base64URLEncode(str) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// 1. Initiate Login with PKCE
app.get('/auth/login', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  
  // Generate PKCE code_verifier and code_challenge
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
  
  pkceStore.set(state, verifier);
  
  const authUrl = oauth2.getAuthorizationUrl({ scope: 'api web refresh_token' }) 
    + `&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
    
  res.redirect(authUrl);
});

// 2. Callback from Salesforce
app.get('/oauth2/callback', async (req, res) => {
  const { code, state } = req.query;
  try {
    const verifier = pkceStore.get(state);
    if (!verifier) {
      throw new Error('Invalid state or missing code_verifier');
    }

    // Manual token exchange to include code_verifier
    const tokenResponse = await axios.post(
      'https://login.salesforce.com/services/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SALESFORCE_CLIENT_ID,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        redirect_uri: process.env.SALESFORCE_CALLBACK_URL,
        code: code,
        code_verifier: verifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, instance_url, refresh_token } = tokenResponse.data;
    
    tokenStore.set(state, {
      accessToken: access_token,
      instanceUrl: instance_url,
      refreshToken: refresh_token
    });

    res.redirect(`${process.env.FRONTEND_URL}?token=${state}`);
  } catch (error) {
    console.error('OAuth Callback Error:', error.response?.data || error.message);
    res.status(500).send('Authentication Failed. Check server logs.');
  }
});

// Helper to get connection
const getConnection = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token || !tokenStore.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const authInfo = tokenStore.get(token);
  req.sfConn = new jsforce.Connection({
    oauth2: oauth2,
    instanceUrl: authInfo.instanceUrl,
    accessToken: authInfo.accessToken,
    refreshToken: authInfo.refreshToken
  });
  
  next();
};

// 3. Get Metadata for object (fields)
app.get('/api/metadata/:objectName', getConnection, async (req, res) => {
  try {
    const { objectName } = req.params;
    const meta = await req.sfConn.describe(objectName);
    const fields = meta.fields
      .filter(f => f.updateable && f.createable && f.type !== 'id')
      .slice(0, 10)
      .map(f => ({ name: f.name, label: f.label, type: f.type }));
      
    fields.unshift({ name: 'Id', label: 'ID', type: 'id' });
    res.json(fields);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get Records (with pagination)
app.get('/api/records/:objectName', getConnection, async (req, res) => {
  try {
    const { objectName } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const meta = await req.sfConn.describe(objectName);
    const fields = meta.fields
      .filter(f => f.updateable && f.createable && f.type !== 'id')
      .slice(0, 10)
      .map(f => f.name);
      
    fields.unshift('Id');
    const queryStr = `SELECT ${fields.join(',')} FROM ${objectName} LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await req.sfConn.query(queryStr);
    res.json({ records: result.records, totalSize: result.totalSize });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Create Record
app.post('/api/records/:objectName', getConnection, async (req, res) => {
  try {
    const { objectName } = req.params;
    const result = await req.sfConn.sobject(objectName).create(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Update Record
app.put('/api/records/:objectName/:id', getConnection, async (req, res) => {
  try {
    const { objectName, id } = req.params;
    const data = { Id: id, ...req.body };
    const result = await req.sfConn.sobject(objectName).update(data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Delete Record
app.delete('/api/records/:objectName/:id', getConnection, async (req, res) => {
  try {
    const { objectName, id } = req.params;
    const result = await req.sfConn.sobject(objectName).destroy(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
