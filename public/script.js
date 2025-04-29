document.addEventListener('DOMContentLoaded', () => {
    // Form elements
    const uploadForm = document.getElementById('upload-form');
    const imagesInput = document.getElementById('images-input');
    const filesCountSpan = document.getElementById('files-count');
    
    // Preview elements
    const previewContainer = document.getElementById('preview-container');
    const previewGrid = document.getElementById('preview-grid');
    const processBtn = document.getElementById('process-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    // Results elements
    const loader = document.getElementById('loader');
    const processingStatus = document.getElementById('processing-status');
    const resultsSection = document.getElementById('results-section');
    const resultsContainer = document.getElementById('results-container');
    const downloadAllBtn = document.getElementById('download-all-btn');
    
    // Array to store files to be processed
    let filesToProcess = [];
    
    // Array to store processed image URLs
    let processedImages = [];
    
    // Update file count and add files to preview grid when files are selected
    imagesInput.addEventListener('change', () => {
        if (!imagesInput.files.length) {
            filesCountSpan.textContent = 'No files chosen';
            return;
        }
        
        const filesCount = imagesInput.files.length;
        filesCountSpan.textContent = `${filesCount} files selected`;
        
        // Add the selected files to our array
        Array.from(imagesInput.files).forEach(file => {
            // Check if a file with the same name already exists
            const exists = filesToProcess.some(f => f.name === file.name);
            if (!exists) {
                filesToProcess.push(file);
            }
        });
        
        // Reset the file input to allow selecting the same files again if needed
        uploadForm.reset();
        filesCountSpan.textContent = 'No files chosen';
        
        // Update preview grid
        updatePreviewGrid();
    });
    
    // Update the preview grid with current files
    function updatePreviewGrid() {
        // Clear the grid
        previewGrid.innerHTML = '';
        
        // Add each file to the grid
        filesToProcess.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            // Create image preview
            const img = document.createElement('img');
            img.className = 'preview-img';
            img.alt = file.name;
            
            // Read the file as a data URL to display preview
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            
            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'preview-remove';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Remove';
            removeBtn.addEventListener('click', () => {
                filesToProcess.splice(index, 1);
                updatePreviewGrid();
            });
            
            // Create filename label
            const nameLabel = document.createElement('div');
            nameLabel.className = 'preview-name';
            nameLabel.textContent = file.name;
            
            // Add elements to the preview item
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            previewItem.appendChild(nameLabel);
            
            // Add preview item to the grid
            previewGrid.appendChild(previewItem);
        });
        
        // Show/hide the preview container based on whether there are files
        previewContainer.style.display = filesToProcess.length > 0 ? 'block' : 'none';
        
        // Enable/disable buttons
        processBtn.disabled = filesToProcess.length === 0;
        clearBtn.disabled = filesToProcess.length === 0;
    }
    
    // Clear all files
    clearBtn.addEventListener('click', () => {
        filesToProcess = [];
        updatePreviewGrid();
    });
    
    // Process all images
    processBtn.addEventListener('click', async () => {
        if (filesToProcess.length === 0) {
            alert('No images to process');
            return;
        }
        
        // Show loader and hide results
        loader.style.display = 'block';
        resultsSection.style.display = 'none';
        previewContainer.style.display = 'none';
        processingStatus.textContent = `Processing ${filesToProcess.length} image(s)...`;
        
        // Create FormData object
        const formData = new FormData();
        filesToProcess.forEach(file => {
            formData.append('images', file);
        });
        
        try {
            // Send the upload request
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }
            
            const data = await response.json();
            console.log('Server response:', data);
            
            // Save the processed images data
            processedImages = data.images;
            
            // Clear files to process
            filesToProcess = [];
            
            // Display the processed images
            displayResults(processedImages);
            
        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error('Upload error:', error);
            previewContainer.style.display = 'block';
        } finally {
            loader.style.display = 'none';
            processingStatus.textContent = '';
        }
    });
    
    // Function to display the processed images
    function displayResults(imagesData) {
        // Show results section
        resultsSection.style.display = 'block';
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        // Create a result group for each uploaded image
        imagesData.forEach((imageData, index) => {
            const imageGroup = document.createElement('div');
            imageGroup.className = 'image-group';
            
            // Image group header
            const header = document.createElement('div');
            header.className = 'image-group-header';
            
            const title = document.createElement('div');
            title.className = 'image-group-title';
            title.textContent = `Image ${index + 1}: ${imageData.originalName}`;
            
            header.appendChild(title);
            imageGroup.appendChild(header);
            
            // Create the results grid for this image
            const resultsGrid = document.createElement('div');
            resultsGrid.className = 'results-grid';
            
            // Add each format
            if (imageData.files.png) {
                resultsGrid.appendChild(createFormatItem('PNG', imageData.files.png));
            }
            
            if (imageData.files.webp) {
                resultsGrid.appendChild(createFormatItem('WebP', imageData.files.webp));
            }
            
            if (imageData.files.png2x) {
                resultsGrid.appendChild(createFormatItem('PNG @2x', imageData.files.png2x));
            }
            
            if (imageData.files.webp2x) {
                resultsGrid.appendChild(createFormatItem('WebP @2x', imageData.files.webp2x));
            }
            
            imageGroup.appendChild(resultsGrid);
            resultsContainer.appendChild(imageGroup);
        });
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Function to create a single format result item
    function createFormatItem(formatName, url) {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        // Title
        const title = document.createElement('div');
        title.className = 'result-title';
        
        const formatTitle = document.createElement('h3');
        formatTitle.textContent = formatName;
        
        title.appendChild(formatTitle);
        item.appendChild(title);
        
        // Image container
        const container = document.createElement('div');
        container.className = 'image-container';
        
        // Image with retry logic
        const img = document.createElement('img');
        let retryCount = 0;
        const maxRetries = 3;
        
        const loadImage = () => {
            img.src = url + '?t=' + new Date().getTime(); // Add cache-busting parameter
            img.alt = `Processed ${formatName} image`;
        };
        
        img.onerror = () => {
            if (retryCount < maxRetries) {
                console.log(`Retrying ${formatName} image load (${retryCount + 1}/${maxRetries})...`);
                retryCount++;
                setTimeout(loadImage, 1000); // Retry after 1 second
            } else {
                console.error(`Error loading ${formatName} image after ${maxRetries} attempts:`, url);
                container.innerHTML = '<div class="error-message">Image not available</div>';
            }
        };
        
        // Start loading the image
        loadImage();
        container.appendChild(img);
        item.appendChild(container);
        
        // Download button
        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = 'Download';
        downloadBtn.href = url + '?download=true';
        
        // Extract filename from URL
        const filename = url.split('/').pop();
        downloadBtn.setAttribute('download', filename);
        
        item.appendChild(downloadBtn);
        
        return item;
    }
    
    // Handle Download All button click (ZIP download)
    downloadAllBtn.addEventListener('click', async () => {
        if (!processedImages.length) {
            alert('No processed images available');
            return;
        }
        
        try {
            // Show loading state
            downloadAllBtn.disabled = true;
            downloadAllBtn.textContent = 'Creating ZIP...';
            
            // Collect all image URLs
            const allImageUrls = [];
            processedImages.forEach(imageData => {
                Object.values(imageData.files).forEach(url => {
                    allImageUrls.push(url);
                });
            });
            
            // Request the ZIP file
            const response = await fetch('/download-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ files: allImageUrls }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create ZIP archive');
            }
            
            // Create a blob from the response
            const blob = await response.blob();
            
            // Create a download link and trigger it
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = 'processed-images.zip';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(downloadLink.href);
            
        } catch (error) {
            console.error('Download error:', error);
            alert(`Error downloading ZIP: ${error.message}`);
        } finally {
            // Reset button state
            downloadAllBtn.disabled = false;
            downloadAllBtn.textContent = 'Download All (ZIP)';
        }
    });
    
    // Add CSS for error message and other styles
    const style = document.createElement('style');
    style.textContent = `
        .error-message {
            color: #e74c3c;
            font-size: 14px;
            padding: 10px;
            text-align: center;
            border: 1px dashed #e74c3c;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .checking-message {
            margin-top: 15px;
            text-align: center;
            color: #3498db;
            font-style: italic;
        }
        
        .disabled-btn {
            background-color: #95a5a6 !important;
            cursor: not-allowed !important;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}); 