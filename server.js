const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from public directory
app.use(express.static('public'));

// Configure multer for handling file uploads
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

// Helper function to process a single image
async function processImage(filePath, originalName) {
  // Generate unique ID for the image outputs
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const baseOutputName = `image-${uniqueId}`;
  
  // Output file paths
  const pngPath = path.join(uploadDir, `${baseOutputName}.png`);
  const webpPath = path.join(uploadDir, `${baseOutputName}.webp`);
  const png2xPath = path.join(uploadDir, `${baseOutputName}@2x.png`);
  const webp2xPath = path.join(uploadDir, `${baseOutputName}@2x.webp`);

  // Get metadata for the original image
  const metadata = await sharp(filePath).metadata();
  console.log(`Processing ${originalName}: ${metadata.width}×${metadata.height}, format: ${metadata.format}`);

  // Create all formats one by one
  try {
    // Regular PNG
    await sharp(filePath)
      .resize(metadata.width, metadata.height)
      .toFormat('png')
      .toFile(pngPath);
    
    // WebP version
    await sharp(filePath)
      .resize(metadata.width, metadata.height)
      .toFormat('webp', { quality: 80 })
      .toFile(webpPath);
    
    // PNG @2x version
    await sharp(filePath)
      .resize(metadata.width * 2, metadata.height * 2)
      .toFormat('png')
      .toFile(png2xPath);
    
    // WebP @2x version
    await sharp(filePath)
      .resize(metadata.width * 2, metadata.height * 2)
      .toFormat('webp', { quality: 80 })
      .toFile(webp2xPath);

    // Verify all files exist and have content
    const fileStatus = {
      png: fs.existsSync(pngPath) && fs.statSync(pngPath).size > 0,
      webp: fs.existsSync(webpPath) && fs.statSync(webpPath).size > 0,
      png2x: fs.existsSync(png2xPath) && fs.statSync(png2xPath).size > 0,
      webp2x: fs.existsSync(webp2xPath) && fs.statSync(webp2xPath).size > 0
    };
    
    // Return only paths to files that were successfully created
    const result = {
      originalName,
      files: {}
    };
    
    if (fileStatus.png) result.files.png = `/images/${baseOutputName}.png`;
    if (fileStatus.webp) result.files.webp = `/images/${baseOutputName}.webp`;
    if (fileStatus.png2x) result.files.png2x = `/images/${baseOutputName}@2x.png`;
    if (fileStatus.webp2x) result.files.webp2x = `/images/${baseOutputName}@2x.webp`;
    
    return result;
  } catch (error) {
    console.error(`Error processing image ${originalName}:`, error);
    throw new Error(`Failed to process ${originalName}: ${error.message}`);
  }
}

// Unified endpoint for uploading and processing images (both single and multiple)
app.post('/upload', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded' });
    }

    console.log(`${req.files.length} file(s) uploaded`);
    
    // Process all images in parallel
    const processPromises = req.files.map(file => 
      processImage(file.path, file.originalname)
    );
    
    // Wait for all processing to complete
    const results = await Promise.all(processPromises);
    
    // Delete the original uploaded files
    req.files.forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error(`Error deleting file ${file.path}:`, err);
      }
    });
    
    res.json({
      message: `Successfully processed ${results.length} image(s)`,
      images: results
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve processed images
app.get('/images/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  console.log(`Serving: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.log('Available files:', fs.readdirSync(uploadDir));
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Determine content type
  const ext = path.extname(req.params.filename).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/webp';
  
  // Set download header if requested
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  }
  
  res.setHeader('Content-Type', contentType);
  
  // Stream the file to the response
  const fileStream = fs.createReadStream(filePath);
  fileStream.on('error', (error) => {
    console.error(`Error streaming file: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming file' });
    }
  });
  
  fileStream.pipe(res);
});

// Download all images as a zip archive
app.post('/download-all', express.json(), async (req, res) => {
  try {
    if (!req.body || !req.body.files || !Array.isArray(req.body.files) || req.body.files.length === 0) {
      return res.status(400).json({ error: 'No files specified for download' });
    }
    
    const files = req.body.files;
    console.log(`Preparing to archive ${files.length} files`);
    
    // Set headers for zip download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="processed-images.zip"');
    
    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Pipe the archive to the response
    archive.pipe(res);
    
    // Add each file to the archive
    for (const fileUrl of files) {
      const filename = fileUrl.split('/').pop();
      const filePath = path.join(uploadDir, filename);
      
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: filename });
      } else {
        console.warn(`File ${filePath} does not exist, skipping`);
      }
    }
    
    // Finalize the archive
    await archive.finalize();
    
  } catch (error) {
    console.error('Error creating archive:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creating archive' });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 