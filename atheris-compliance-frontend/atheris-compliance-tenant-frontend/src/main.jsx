import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline, Container, Typography, Box } from '@mui/material'

function App() {
  return (
    <ThemeProvider theme={{}}>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Atheris Compliance — Tenant Portal
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Tenant compliance management frontend. Coming soon.
        </Typography>
      </Container>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
