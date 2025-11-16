import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Support multiple course paths separated by comma or semicolon
const COURSE_PATHS = process.env.COURSE_PATH
  ? process.env.COURSE_PATH.split(/[,;]/).map(p => p.trim()).filter(Boolean)
  : [];

const DATA_FILE = path.resolve("./data.json");
const PROGRESS_FILE = path.resolve("./progress.json");
const GAMIFICATION_FILE = path.resolve("./gamification.json");
const NOTES_FILE = path.resolve("./notes.json");
const QUIZZES_FILE = path.resolve("./quizzes.json");
const ANALYTICS_FILE = path.resolve("./analytics.json");
const QUESTS_FILE = path.resolve("./quests.json");

// Generate data.json automatically from multiple paths
function generateCourseData() {
  const data = { courses: [] };
  let courseId = 1;

  if (COURSE_PATHS.length === 0) {
    console.error(`❌ No COURSE_PATH configured`);
    return data;
  }

  console.log(`\n📂 Scanning ${COURSE_PATHS.length} course path(s)...`);

  for (const COURSE_PATH of COURSE_PATHS) {
    if (!fs.existsSync(COURSE_PATH)) {
      console.error(`❌ Path not found: ${COURSE_PATH}`);
      continue;
    }

    console.log(`\n📁 Scanning: ${COURSE_PATH}`);

    const courseDirs = fs
      .readdirSync(COURSE_PATH, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const courseName of courseDirs) {
      const courseFolder = path.join(COURSE_PATH, courseName);
      const files = fs.readdirSync(courseFolder);
      
      const videoFiles = files.filter((f) => f.toLowerCase().endsWith(".mp4"));
      const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

      console.log(`   ✓ ${courseName}: ${videoFiles.length} videos, ${pdfFiles.length} PDFs`);

      const videos = videoFiles.map((file, index) => ({
        id: courseId * 1000 + index + 1,
        title: path.basename(file, ".mp4"),
        filePath: file,
        coursePath: COURSE_PATH,
        type: "video"
      }));

      const pdfs = pdfFiles.map((file, index) => ({
        id: courseId * 1000 + videoFiles.length + index + 1,
        title: path.basename(file, ".pdf"),
        filePath: file,
        coursePath: COURSE_PATH,
        type: "pdf"
      }));

      data.courses.push({
        id: courseId++,
        title: courseName,
        coursePath: COURSE_PATH,
        videos,
        pdfs,
        content: [...videos, ...pdfs]
      });
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`\n✅ data.json generated with ${data.courses.length} courses`);
  return data;
}

// Read existing JSON
function readData() {
  if (!fs.existsSync(DATA_FILE)) return { courses: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// Read progress data
function readProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return {};
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
}

// Save progress data
function saveProgress(progressData) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2));
}

// Read gamification data
function readGamification() {
  if (!fs.existsSync(GAMIFICATION_FILE)) {
    return {
      stats: {
        totalXP: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        totalVideosCompleted: 0,
        totalCoursesCompleted: 0
      },
      achievements: [
        { id: "first-video", title: "First Steps", description: "Complete your first video", icon: "🎬", unlocked: false },
        { id: "5-videos", title: "Getting Started", description: "Complete 5 videos", icon: "🌟", unlocked: false },
        { id: "10-videos", title: "Dedicated Learner", description: "Complete 10 videos", icon: "📚", unlocked: false },
        { id: "first-course", title: "Course Conqueror", description: "Complete your first course", icon: "🏆", unlocked: false },
        { id: "3-day-streak", title: "Consistent", description: "Maintain a 3-day streak", icon: "🔥", unlocked: false },
        { id: "7-day-streak", title: "Week Warrior", description: "Maintain a 7-day streak", icon: "⚡", unlocked: false },
        { id: "level-5", title: "Rising Star", description: "Reach level 5", icon: "⭐", unlocked: false },
        { id: "level-10", title: "Expert", description: "Reach level 10", icon: "💎", unlocked: false },
        { id: "night-owl", title: "Night Owl", description: "Complete a video after 10 PM", icon: "🦉", unlocked: false },
        { id: "early-bird", title: "Early Bird", description: "Complete a video before 7 AM", icon: "🐦", unlocked: false }
      ]
    };
  }
  return JSON.parse(fs.readFileSync(GAMIFICATION_FILE, "utf8"));
}

// Save gamification data
function saveGamification(gamificationData) {
  fs.writeFileSync(GAMIFICATION_FILE, JSON.stringify(gamificationData, null, 2));
}

// Generate on startup
let courseData = generateCourseData();

// ========== COURSE APIs ==========

// API: Get all courses
app.get("/api/courses", (req, res) => {
  courseData = readData();
  res.json(courseData.courses);
});

// API: Get videos of a course
app.get("/api/courses/:id/videos", (req, res) => {
  const data = readData();
  const course = data.courses.find((c) => c.id === parseInt(req.params.id));
  if (!course) return res.status(404).send("Course not found");
  res.json(course.videos);
});

// ========== PROGRESS APIs ==========

// API: Get video progress
app.get("/api/progress/:videoId", (req, res) => {
  const progress = readProgress();
  const videoId = req.params.videoId;
  res.json({ 
    videoId, 
    currentTime: progress[videoId]?.currentTime || 0,
    duration: progress[videoId]?.duration || 0,
    completed: progress[videoId]?.completed || false,
    lastUpdated: progress[videoId]?.lastUpdated || null
  });
});

// API: Save video progress
app.post("/api/progress/:videoId", (req, res) => {
  const videoId = req.params.videoId;
  const { currentTime, duration, completed, lastUpdated } = req.body;
  
  const progress = readProgress();
  progress[videoId] = {
    currentTime: parseFloat(currentTime) || 0,
    duration: parseFloat(duration) || 0,
    completed: completed || false,
    lastUpdated: lastUpdated || new Date().toISOString()
  };
  
  saveProgress(progress);
  res.json({ success: true, progress: progress[videoId] });
});

// API: Get all progress
app.get("/api/progress", (req, res) => {
  const progress = readProgress();
  res.json(progress);
});

// ========== GAMIFICATION APIs ==========

// API: Get user stats
app.get("/api/gamification/stats", (req, res) => {
  const gamification = readGamification();
  res.json(gamification.stats);
});

// API: Save user stats
app.post("/api/gamification/stats", (req, res) => {
  const gamification = readGamification();
  gamification.stats = req.body;
  saveGamification(gamification);
  res.json({ success: true, stats: gamification.stats });
});

// API: Get achievements
app.get("/api/gamification/achievements", (req, res) => {
  const gamification = readGamification();
  res.json(gamification.achievements);
});

// API: Save achievements
app.post("/api/gamification/achievements", (req, res) => {
  const gamification = readGamification();
  gamification.achievements = req.body;
  saveGamification(gamification);
  res.json({ success: true, achievements: gamification.achievements });
});

// API: Reset gamification data
app.post("/api/gamification/reset", (req, res) => {
  const defaultData = {
    stats: {
      totalXP: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      totalVideosCompleted: 0,
      totalCoursesCompleted: 0
    },
    achievements: [
      { id: "first-video", title: "First Steps", description: "Complete your first video", icon: "🎬", unlocked: false },
      { id: "5-videos", title: "Getting Started", description: "Complete 5 videos", icon: "🌟", unlocked: false },
      { id: "10-videos", title: "Dedicated Learner", description: "Complete 10 videos", icon: "📚", unlocked: false },
      { id: "first-course", title: "Course Conqueror", description: "Complete your first course", icon: "🏆", unlocked: false },
      { id: "3-day-streak", title: "Consistent", description: "Maintain a 3-day streak", icon: "🔥", unlocked: false },
      { id: "7-day-streak", title: "Week Warrior", description: "Maintain a 7-day streak", icon: "⚡", unlocked: false },
      { id: "level-5", title: "Rising Star", description: "Reach level 5", icon: "⭐", unlocked: false },
      { id: "level-10", title: "Expert", description: "Reach level 10", icon: "💎", unlocked: false },
      { id: "night-owl", title: "Night Owl", description: "Complete a video after 10 PM", icon: "🦉", unlocked: false },
      { id: "early-bird", title: "Early Bird", description: "Complete a video before 7 AM", icon: "🐦", unlocked: false }
    ]
  };
  saveGamification(defaultData);
  res.json({ success: true, message: "Gamification data reset successfully" });
});

// ========== STREAMING APIs ==========

// API: Stream video
app.get("/api/stream/:course/:filename", (req, res) => {
  const courseName = decodeURIComponent(req.params.course);
  const data = readData();
  
  const course = data.courses.find(c => c.title === courseName);
  if (!course) return res.status(404).send("Course not found");
  
  const videoPath = path.join(course.coursePath, courseName, req.params.filename);

  if (!fs.existsSync(videoPath)) return res.status(404).send("Video not found");

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) return res.status(416).send("Requires Range header");

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunksize = end - start + 1;

  const file = fs.createReadStream(videoPath, { start, end });
  const head = {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunksize,
    "Content-Type": "video/mp4",
  };

  res.writeHead(206, head);
  file.pipe(res);
});

// API: Serve PDF
app.get("/api/pdf/:course/:filename", (req, res) => {
  const courseName = decodeURIComponent(req.params.course);
  const data = readData();
  
  const course = data.courses.find(c => c.title === courseName);
  if (!course) return res.status(404).send("Course not found");
  
  const pdfPath = path.join(course.coursePath, courseName, req.params.filename);

  if (!fs.existsSync(pdfPath)) return res.status(404).send("PDF not found");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  
  const fileStream = fs.createReadStream(pdfPath);
  fileStream.pipe(res);
});

// API: Refresh courses
app.post("/api/refresh", (req, res) => {
  console.log("\n🔄 Refreshing course data...");
  courseData = generateCourseData();
  res.json({ success: true, courses: courseData.courses.length });
});

app.listen(process.env.PORT || 4000, () => {
  console.log(`🚀 LMS API running at http://localhost:${process.env.PORT || 4000}`);
  console.log(`📚 Monitoring ${COURSE_PATHS.length} course path(s)`);
  console.log(`🎮 Gamification system active`);
});