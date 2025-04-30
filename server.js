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

// Helper function to generate a random 5-character hash
function generateRandomHash() {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Helper function to check if output files for a base name already exist
function outputFilesExist(baseName) {
  const pngPath = path.join(uploadDir, `${baseName}.png`);
  const webpPath = path.join(uploadDir, `${baseName}.webp`);
  const png2xPath = path.join(uploadDir, `${baseName}@2x.png`);
  const webp2xPath = path.join(uploadDir, `${baseName}@2x.webp`);
  
  return fs.existsSync(pngPath) || fs.existsSync(webpPath) || 
         fs.existsSync(png2xPath) || fs.existsSync(webp2xPath);
}

// Helper function to process a single image
async function processImage(filePath, originalName, useHash) {
  // Extract the base name without extension
  const fileInfo = path.parse(originalName);
  const baseName = fileInfo.name;
  let baseOutputName;
  
  if (useHash) {
    const randomHash = generateRandomHash();
    baseOutputName = `${baseName}-${randomHash}`;
    console.log(`Processing ${originalName} -> ${baseOutputName} (with hash)`);
  } else {
    baseOutputName = baseName;
    console.log(`Processing ${originalName} -> ${baseOutputName} (original name)`);
  }
  
  // Output file paths
  const pngPath = path.join(uploadDir, `${baseOutputName}.png`);
  const webpPath = path.join(uploadDir, `${baseOutputName}.webp`);
  const png2xPath = path.join(uploadDir, `${baseOutputName}@2x.png`);
  const webp2xPath = path.join(uploadDir, `${baseOutputName}@2x.webp`);

  // Get metadata for the original image
  const metadata = await sharp(filePath).metadata();
  
  // Calculate dimensions for regular and 2x versions
  // For regular version, optionally reduce dimensions to optimize
  const regularWidth = Math.min(metadata.width, 1200); // Limit width to 1200px
  const regularHeight = Math.round(regularWidth * (metadata.height / metadata.width));
  
  // For 2x version, double the regular size but still with reasonable limits
  const doubleWidth = regularWidth * 2;
  const doubleHeight = regularHeight * 2;
  
  console.log(`Image dimensions: 
    Original: ${metadata.width}×${metadata.height} 
    Regular: ${regularWidth}×${regularHeight}
    Double: ${doubleWidth}×${doubleHeight}`);
  
  // Create all formats one by one
  try {
    // Regular PNG with compression
    await sharp(filePath)
      .resize(regularWidth, regularHeight)
      .png({ compressionLevel: 9, adaptiveFiltering: true, quality: 90 })
      .toFile(pngPath);
    
    // WebP version with better compression
    await sharp(filePath)
      .resize(regularWidth, regularHeight)
      .webp({ quality: 90, lossless: false })
      .toFile(webpPath);
    
    // PNG @2x version with compression
    await sharp(filePath)
      .resize(doubleWidth, doubleHeight)
      .png({ compressionLevel: 9, adaptiveFiltering: true, quality: 90 })
      .toFile(png2xPath);
    
    // WebP @2x version with better compression
    await sharp(filePath)
      .resize(doubleWidth, doubleHeight)
      .webp({ quality: 90, lossless: false })
      .toFile(webp2xPath);

    // Verify all files exist and have content
    const fileStatus = {
      png: fs.existsSync(pngPath) && fs.statSync(pngPath).size > 0,
      webp: fs.existsSync(webpPath) && fs.statSync(webpPath).size > 0,
      png2x: fs.existsSync(png2xPath) && fs.statSync(png2xPath).size > 0,
      webp2x: fs.existsSync(webp2xPath) && fs.statSync(webp2xPath).size > 0
    };
    
    // Show file sizes
    if (fileStatus.png) {
      console.log(`File sizes:
        Original: ${Math.round(fs.statSync(filePath).size / 1024)}KB
        PNG: ${Math.round(fs.statSync(pngPath).size / 1024)}KB
        WebP: ${Math.round(fs.statSync(webpPath).size / 1024)}KB
        PNG@2x: ${Math.round(fs.statSync(png2xPath).size / 1024)}KB
        WebP@2x: ${Math.round(fs.statSync(webp2xPath).size / 1024)}KB`);
    }
    
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
    
    // Clear all existing output files
    console.log("Cleaning previous output files...");
    fs.readdirSync(uploadDir).forEach(file => {
      if (file.endsWith('.png') || file.endsWith('.webp')) {
        try {
          fs.unlinkSync(path.join(uploadDir, file));
        } catch (err) {
          console.error(`Error deleting file ${file}:`, err);
        }
      }
    });
    
    // Group files by their base name to identify duplicates
    const fileGroups = new Map();
    
    // Group files by base name
    req.files.forEach(file => {
      const baseName = path.parse(file.originalname).name;
      if (!fileGroups.has(baseName)) {
        fileGroups.set(baseName, []);
      }
      fileGroups.get(baseName).push(file);
    });
    
    // List all groups and their sizes
    console.log("File groups:");
    for (const [baseName, files] of fileGroups.entries()) {
      console.log(`- ${baseName}: ${files.length} file(s)`);
    }
    
    // Process files with the appropriate hash flag
    const allProcessPromises = [];
    
    // Process each group of files
    for (const [baseName, files] of fileGroups.entries()) {
      const hasMultipleFiles = files.length > 1;
      
      if (hasMultipleFiles) {
        console.log(`Group ${baseName} has multiple files, adding hashes to all`);
        for (const file of files) {
          allProcessPromises.push(processImage(file.path, file.originalname, true));
        }
      } else {
        console.log(`Group ${baseName} has a single file, using original name`);
        const file = files[0];
        allProcessPromises.push(processImage(file.path, file.originalname, false));
      }
    }
    
    // Wait for all processing to complete
    const results = await Promise.all(allProcessPromises);
    
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