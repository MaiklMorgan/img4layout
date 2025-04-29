const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Base URL for the API
const BASE_URL = 'http://localhost:3000';

/**
 * Upload a single image
 * @param {string} imagePath - Path to the image file
 */
async function uploadSingleImage(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      console.error(`Error: File not found: ${imagePath}`);
      return;
    }

    console.log(`Uploading single image: ${imagePath}`);
    
    const formData = new FormData();
    formData.append('images', fs.createReadStream(imagePath));
    
    const response = await axios.post(`${BASE_URL}/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    console.log('Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    // Log available formats
    const imageData = response.data.images[0];
    console.log(`\nAvailable formats for ${imageData.originalName}:`);
    Object.entries(imageData.files).forEach(([format, url]) => {
      console.log(`- ${format}: ${BASE_URL}${url}`);
    });
  } catch (error) {
    console.error('Error uploading image:', error.response?.data || error.message);
  }
}

/**
 * Upload multiple images
 * @param {string[]} imagePaths - Array of paths to image files
 */
async function uploadMultipleImages(imagePaths) {
  try {
    // Validate files exist
    const validPaths = imagePaths.filter(path => {
      if (!fs.existsSync(path)) {
        console.error(`Warning: File not found: ${path}`);
        return false;
      }
      return true;
    });

    if (validPaths.length === 0) {
      console.error('Error: No valid image files provided');
      return;
    }

    console.log(`Uploading ${validPaths.length} images...`);
    
    const formData = new FormData();
    validPaths.forEach(imagePath => {
      formData.append('images', fs.createReadStream(imagePath));
    });
    
    const response = await axios.post(`${BASE_URL}/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    console.log('Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    // Log available formats for each image
    console.log('\nAvailable formats:');
    response.data.images.forEach(imageData => {
      console.log(`\nFor ${imageData.originalName}:`);
      Object.entries(imageData.files).forEach(([format, url]) => {
        console.log(`- ${format}: ${BASE_URL}${url}`);
      });
    });
  } catch (error) {
    console.error('Error uploading images:', error.response?.data || error.message);
  }
}

/**
 * Download all processed images as a ZIP file
 * @param {string[]} fileUrls - Array of file URLs to download
 */
async function downloadAllAsZip(fileUrls) {
  try {
    console.log('Requesting ZIP download...');
    
    const response = await axios.post(
      `${BASE_URL}/download-all`, 
      { files: fileUrls },
      { 
        responseType: 'stream',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    const outputPath = path.join(process.cwd(), 'processed-images.zip');
    const writer = fs.createWriteStream(outputPath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`ZIP file downloaded to: ${outputPath}`);
        resolve();
      });
      
      writer.on('error', err => {
        console.error('Error writing ZIP file:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error downloading ZIP:', error.response?.data || error.message);
  }
}

// Main function to handle different test scenarios
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage:
  Single image upload:  node test.js upload /path/to/image.jpg
  Multiple uploads:     node test.js upload-multiple /path/to/image1.jpg /path/to/image2.png ...
  Download example:     node test.js download /images/file1.png /images/file2.webp ...
    `);
    return;
  }
  
  const command = args[0];
  
  if (command === 'upload' && args.length >= 2) {
    await uploadSingleImage(args[1]);
  } 
  else if (command === 'upload-multiple' && args.length >= 2) {
    await uploadMultipleImages(args.slice(1));
  }
  else if (command === 'download' && args.length >= 2) {
    await downloadAllAsZip(args.slice(1));
  }
  else {
    console.error('Invalid command or missing arguments');
    console.log('Use "node test.js" without arguments to see usage instructions');
  }
}

main().catch(console.error); 