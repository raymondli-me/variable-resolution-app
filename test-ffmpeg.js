// Test script to debug FFmpeg detection
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testFFmpeg() {
  console.log('=== FFmpeg Detection Test ===');
  console.log('Platform:', os.platform());
  console.log('Current PATH:', process.env.PATH);
  console.log('');

  const paths = [
    'ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    path.join(os.homedir(), '.local/bin/ffmpeg')
  ];

  for (const ffmpegPath of paths) {
    console.log(`\nTesting: ${ffmpegPath}`);
    
    // Check if file exists
    if (ffmpegPath.includes('/')) {
      const exists = fs.existsSync(ffmpegPath);
      console.log(`  File exists: ${exists}`);
      
      if (exists) {
        const stats = fs.statSync(ffmpegPath);
        console.log(`  Is file: ${stats.isFile()}`);
        console.log(`  Is executable: ${(stats.mode & parseInt('111', 8)) !== 0}`);
      }
    }
    
    // Try to run it
    try {
      const result = await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, ['-version'], { 
          shell: false,
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`
          }
        });
        
        let output = '';
        let error = '';
        
        proc.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        proc.on('close', (code) => {
          resolve({
            success: code === 0,
            output: output.substring(0, 200),
            error: error.substring(0, 200),
            code
          });
        });
        
        proc.on('error', (err) => {
          reject(err);
        });
      });
      
      console.log(`  Execution successful: ${result.success}`);
      console.log(`  Exit code: ${result.code}`);
      if (result.output) {
        console.log(`  Version: ${result.output.split('\n')[0]}`);
      }
    } catch (err) {
      console.log(`  Execution failed: ${err.message}`);
    }
  }
  
  console.log('\n=== Which command ===');
  try {
    const which = await new Promise((resolve) => {
      const proc = spawn('which', ['ffmpeg'], { shell: false });
      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      proc.on('close', () => {
        resolve(output.trim());
      });
    });
    console.log('which ffmpeg:', which);
  } catch (err) {
    console.log('which command failed:', err.message);
  }
}

testFFmpeg().catch(console.error);