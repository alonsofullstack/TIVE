const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'servicio', 'verCertificado', 'Tive');
const HASH_REGEX = /^[A-F0-9]{64}$/i;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function isValidHash(hash) {
  return HASH_REGEX.test(hash);
}

app.get(['/verCertificado/:hash', '/servicio/verCertificado/Tive/:hash'], (req, res) => {
  const hash = req.params.hash.toUpperCase();

  if (!isValidHash(hash)) {
    return res.status(400).send('Hash inválido');
  }

  const fileName = `${hash}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Certificado no encontrado');
  }

  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile) {
    res.download(filePath, fileName);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="TIVE_${hash}.pdf"`);
    res.contentType("application/pdf");
    res.sendFile(filePath);
  }
});

app.use('/servicio/verCertificado', express.static(uploadDir));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en el puerto: ${PORT}`);
  console.log(`📁 Archivos guardándose en: ${uploadDir}`);
});