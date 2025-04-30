# img4layout 

## Image Processing Server

A Node.js Express application for image processing, running in a Docker container.

## Features

- Upload images through a REST API or web interface
- Process images using the Sharp library:
  - Minify/compress images (output is smaller than input)
  - Convert to PNG and WebP formats
  - Generate standard (max 1200px width) and @2x resolution versions
  - Preserve unique filenames, add hash suffixes for duplicates
- Download processed images directly or serve through API
- User-friendly web interface for testing and using the tool

## Upload Limitations

- **Maximum file size:** 20MB per image
- **Maximum files per upload:** 10 images
- **Supported formats:** JPG, JPEG, PNG, GIF, WebP, AVIF, TIFF, etc.

## Image Processing Details

- **Resolution:**
  - Standard size: Width limited to 1200px maximum (preserving aspect ratio)
  - @2x size: Width limited to 2400px maximum (preserving aspect ratio)
- **Output formats:** 
  - PNG: High quality (90%) with optimal compression (level 9)
  - WebP: High quality (90%) with optimal compression
- **File naming:**
  - Files with unique names preserve their original base name
  - Files with duplicate names receive a 5-character random suffix
- **Compression:** Images are optimized for high quality while still reducing file size

## Prerequisites

- Docker
- Node.js (for local development)

### Using Docker

1. **Build the Docker image:**
   ```bash
   docker build -t image-processor .
   ```

2. **Run the container:**
   ```bash
   docker run --name imgtool -p 3000:3000 image-processor
   ```

3. **Access the web interface at:** http://localhost:3000

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

## Web Interface

The application includes a web interface where you can:
- Upload images directly through a form
- View the processed images in all formats (PNG, WebP, PNG@2x, WebP@2x)
- Download any of the processed versions

## API Endpoints

### `GET /api/health`

Returns a simple message indicating the server is running.

### `POST /upload`

Upload and process one or multiple images.

- **Request:** Multipart form data with a field named `images` (can contain multiple files)
- **Response:** JSON with the URLs of the processed images
  ```json
  {
    "message": "Successfully processed 3 image(s)",
    "images": [
      {
        "originalName": "photo.jpg",
        "files": {
          "png": "/images/photo.png",
          "webp": "/images/photo.webp",
          "png2x": "/images/photo@2x.png",
          "webp2x": "/images/photo@2x.webp"
        }
      },
      // Additional images...
    ]
  }
  ```

### `POST /download-all`

Download multiple processed images as a ZIP archive.

- **Request:** JSON with an array of file URLs
  ```json
  {
    "files": [
      "/images/photo.png",
      "/images/photo.webp",
      // Additional files...
    ]
  }
  ```
- **Response:** ZIP file containing all requested images

### `GET /images/:filename`

Retrieve a processed image by filename.

- To download the image directly, add `?download=true` query parameter

## Testing

### Using the Web Interface
1. Open http://localhost:3000 in your browser
2. Upload one or more images using the form
3. View and download the processed images
4. Use the "Download All (ZIP)" button to get all images in a single archive

### Using the API
A test script is provided to demonstrate the upload functionality:

```bash
# Show usage instructions
node test.js

# Upload a single image
node test.js upload /path/to/your/image.jpg

# Upload multiple images at once
node test.js upload-multiple /path/to/image1.jpg /path/to/image2.png /path/to/image3.gif

# Download multiple images as a ZIP file (after uploading)
node test.js download /images/image1.png /images/image2.webp
```

## Performance Considerations

- **Large Files:** Very large images (>10MB) will take longer to process
- **Batch Processing:** Processing many images at once increases memory usage
- **Server Resources:** For heavy usage, consider adjusting Docker container resources
- **Temporary Storage:** Processed images are stored temporarily and may be cleared periodically

## File Structure

- `server.js` - Main Express server code
- `test.js` - API testing script for command-line use
- `public/` - Web interface files
  - `index.html` - HTML form and layout
  - `style.css` - Styling for the web interface
  - `script.js` - Client-side JavaScript for the web interface
- `Dockerfile` - Docker configuration
- `/tmp/uploads` - Directory where processed images are temporarily stored

## Dependencies

- Express - Web server framework
- Multer - File upload handling
- Sharp - Image processing library
- Archiver - ZIP file creation for batch downloads
- Axios - HTTP client (used for testing)
- Form-Data - Multipart form handling for API testing