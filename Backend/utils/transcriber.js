// utils/transcriber.js
/*
import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { tmpdir } from "os";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
console.log("transcribeAudioFromVideo() is being called...");


ffmpeg.setFfmpegPath(ffmpegPath);

export async function transcribeAudioFromVideo(videoUrl) {
  return new Promise((resolve, reject) => {
    const audioOutput = path.join(tmpdir(), `${uuid()}.mp3`);

    ffmpeg(videoUrl)
      .noVideo()
      .format("mp3")
      .on("end", () => {
        execFile("python", ["./transcribe.py", audioOutput], (err, stdout, stderr) => {
          fs.unlinkSync(audioOutput); // clean up temp file
          if (err) return reject(err);
          resolve(stdout.trim());
        });
      })
      .on("error", (err) => {
        reject(err);
      })
      .save(audioOutput);
  });
}
*/

import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { tmpdir } from "os";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import axios from "axios";

ffmpeg.setFfmpegPath(ffmpegPath);

async function validateVideoUrl(url) {
  try {
    const res = await axios.head(url);
    return res.status === 200;
  } catch (e) {
    console.error("Video URL validation failed:", e.message);
    return false;
  }
}

export async function transcribeAudioFromVideo(videoUrl) {
  console.log("transcribeAudioFromVideo() called with:", videoUrl);

  // Validate input URL before running ffmpeg
  if (!(await validateVideoUrl(videoUrl))) {
    throw new Error("Invalid or inaccessible video URL: " + videoUrl);
  }

  return new Promise((resolve, reject) => {
    const audioOutput = path.join(tmpdir(), `${uuid()}.mp3`);

    console.log("Temporary audio file:", audioOutput);

    ffmpeg(videoUrl)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioChannels(1) // mono (lighter)
      .audioFrequency(16000) // 16k sample rate (good for speech)
      .format("mp3")
      .outputOptions(["-threads 1"]) // avoid Render memory overload
      .on("start", (cmd) => console.log("FFmpeg started with:", cmd))
      .on("stderr", (line) => console.log("FFmpeg stderr:", line))
      .on("error", (err) => {
        console.error("FFmpeg failed:", err);
        reject(new Error("FFmpeg error: " + err.message));
      })
      .on("end", () => {
        console.log("FFmpeg finished, running transcription...");

        execFile("python", ["./transcribe.py", audioOutput], (err, stdout, stderr) => {
          if (err) {
            console.error("Python script error:", stderr);
            fs.unlink(audioOutput, () => {}); // cleanup
            return reject(new Error("Python transcription failed: " + stderr));
          }

          console.log("Python transcription success");
          fs.unlink(audioOutput, () => {}); // async cleanup
          resolve(stdout.trim());
        });
      })
      .save(audioOutput);
  });
}
