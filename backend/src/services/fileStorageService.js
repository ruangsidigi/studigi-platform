/**
 * File Storage Service
 * Handles file uploads to Supabase storage and local filesystem
 */

const supabase = require('../config/supabase');
const path = require('path');
const fs = require('fs');

/**
 * Upload a file to Supabase storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} bucket - Supabase bucket name (e.g., 'materials', 'excel-uploads')
 * @param {string} folder - Folder path within bucket (e.g., 'pdf', 'questions')
 * @returns {Promise<Object>} - { path, url, publicUrl }
 */
const uploadToSupabase = async (fileBuffer, filename, bucket, folder) => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
    const filePath = `${folder}/${uniqueFilename}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      path: filePath,
      url: data.path,
      publicUrl: publicUrlData.publicUrl,
      bucket,
    };
  } catch (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }
};

/**
 * Upload to local filesystem (backup/fallback)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path (e.g., 'materials', 'excel')
 * @returns {Promise<string>} - File path
 */
const uploadToLocalStorage = async (fileBuffer, filename, folder) => {
  try {
    const storageDir = path.resolve(__dirname, '../../storage', folder);
    
    // Create directory if not exists
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
    const filePath = path.join(storageDir, uniqueFilename);

    // Write file
    fs.writeFileSync(filePath, fileBuffer);

    // Return relative path for storage
    return `/storage/${folder}/${uniqueFilename}`;
  } catch (error) {
    throw new Error(`Local storage error: ${error.message}`);
  }
};

/**
 * Upload PDF file
 * @param {Buffer|Stream} file - File data
 * @param {string} filename - Original filename
 * @param {string} packageName - Package name for organization
 * @returns {Promise<Object>} - Upload result
 */
const uploadPDF = async (file, filename, packageName) => {
  try {
    // Validate filename
    if (!filename.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF files are allowed');
    }

    const fileBuffer = Buffer.isBuffer(file) ? file : await file.buffer();

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size exceeds 50MB limit. Got ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Try Supabase first
    try {
      return await uploadToSupabase(fileBuffer, filename, 'materials', 'pdf');
    } catch (supabaseError) {
      console.warn('Supabase upload failed, trying local storage:', supabaseError.message);
      
      // Fallback to local storage
      const localPath = await uploadToLocalStorage(fileBuffer, filename, 'materials');
      return {
        path: localPath,
        url: localPath,
        publicUrl: `http://localhost:5000${localPath}`,
        bucket: 'local',
      };
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Upload Excel file
 * @param {Buffer|Stream} file - File data
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} - Upload result
 */
const uploadExcel = async (file, filename) => {
  try {
    // Validate filename
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = validExtensions.some(ext => 
      filename.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      throw new Error(`Only Excel files are allowed. Supported: ${validExtensions.join(', ')}`);
    }

    const fileBuffer = Buffer.isBuffer(file) ? file : await file.buffer();

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size exceeds 10MB limit. Got ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Try Supabase first
    try {
      return await uploadToSupabase(fileBuffer, filename, 'excel-uploads', 'questions');
    } catch (supabaseError) {
      console.warn('Supabase upload failed, trying local storage:', supabaseError.message);
      
      // Fallback to local storage
      const localPath = await uploadToLocalStorage(fileBuffer, filename, 'excel');
      return {
        path: localPath,
        url: localPath,
        publicUrl: `http://localhost:5000${localPath}`,
        bucket: 'local',
      };
    }
  } catch (error) {
    throw error;
  }
};

module.exports = {
  uploadToSupabase,
  uploadToLocalStorage,
  uploadPDF,
  uploadExcel,
};
