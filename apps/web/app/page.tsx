"use client";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Play, BookOpen, Video, CheckCircle2, FileText, Clock, Award, Home, Menu, X, Sun, Moon, Trophy, Zap, TrendingUp, Star, Target, Flame, Users, Crown, Medal } from "lucide-react";

const API = "http://localhost:4000/api";

interface ContentItem {
  id: number;
  title: string;
  filePath: string;
  type: "video" | "pdf";
}

interface Video extends ContentItem {
  type: "video";
  pdf?: ContentItem;
}

interface Course {
  id: number;
  title: string;
  videos: Video[];
  pdfs?: ContentItem[];
  content?: ContentItem[];
}

interface VideoProgress {
  currentTime: number;
  duration: number;
  completed: boolean;
  lastUpdated?: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

interface UserStats {
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalVideosCompleted: number;
  totalCoursesCompleted: number;
  lastActivityDate?: string;
}

export default function Dashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [showPDF, setShowPDF] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [allProgress, setAllProgress] = useState<Record<string, VideoProgress>>({});
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [xpGained, setXpGained] = useState(0);
  
  const [userStats, setUserStats] = useState<UserStats>({
    totalXP: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    totalVideosCompleted: 0,
    totalCoursesCompleted: 0
  });

  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "first-video", title: "First Steps", description: "Complete your first video", icon: "🎬", unlocked: false },
    { id: "5-videos", title: "Getting Started", description: "Complete 5 videos", icon: "🌟", unlocked: false },
    { id: "10-videos", title: "Dedicated Learner", description: "Complete 10 videos", icon: "📚", unlocked: false },
    { id: "first-course", title: "Course Conqueror", description: "Complete your first course", icon: "🏆", unlocked: false },
    { id: "3-day-streak", title: "Consistent", description: "Maintain a 3-day streak", icon: "🔥", unlocked: false },
    { id: "7-day-streak", title: "Week Warrior", description: "Maintain a 7-day streak", icon: "⚡", unlocked: false },
    { id: "level-5", title: "Rising Star", description: "Reach level 5", icon: "⭐", unlocked: false },
    { id: "level-10", title: "Expert", description: "Reach level 10", icon: "💎", unlocked: false },
    { id: "night-owl", title: "Night Owl", description: "Complete a video after 10 PM", icon: "🦉", unlocked: false },
    { id: "early-bird", title: "Early Bird", description: "Complete a video before 7 AM", icon: "🐦", unlocked: false },
  ]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Load gamification data first
      await loadUserData();
      
      // Load progress
      await loadAllProgress();
      
      // Load courses
      const res = await axios.get<Course[]>(`${API}/courses`);
      const processedCourses = res.data.map(course => {
        const videos = course.videos.map(video => {
          const matchingPDF = course.pdfs?.find(pdf => {
            const videoName = video.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const pdfName = pdf.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            return videoName.includes(pdfName) || pdfName.includes(videoName);
          });
          return { ...video, pdf: matchingPDF };
        });
        return { ...course, videos };
      });
      setCourses(processedCourses);
    };
    
    fetchData();
  }, []);

  const loadUserData = async () => {
    try {
      // Load user stats
      const statsRes = await axios.get(`${API}/gamification/stats`);
      const stats = statsRes.data;
      setUserStats(stats);
      updateStreak(stats);
      
      // Load achievements
      const achievementsRes = await axios.get(`${API}/gamification/achievements`);
      setAchievements(achievementsRes.data);
    } catch (error) {
      console.error("Failed to load gamification data:", error);
    }
  };

  const saveUserData = async (stats: UserStats) => {
    try {
      await axios.post(`${API}/gamification/stats`, stats);
      setUserStats(stats);
    } catch (error) {
      console.error("Failed to save user stats:", error);
    }
  };

  const updateStreak = (stats: UserStats) => {
    const today = new Date().toDateString();
    const lastActivity = stats.lastActivityDate ? new Date(stats.lastActivityDate).toDateString() : null;
    
    if (lastActivity === today) {
      return stats.currentStreak;
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    if (lastActivity === yesterdayStr) {
      return stats.currentStreak;
    }
    
    if (lastActivity && lastActivity !== yesterdayStr) {
      stats.currentStreak = 0;
      saveUserData(stats);
    }
    
    return stats.currentStreak;
  };

  const calculateUserStats = (coursesData: Course[]) => {
    const completedVideos = Object.values(allProgress).filter(p => p.completed).length;
    const completedCourses = coursesData.filter(course => 
      course.videos.every(v => allProgress[v.id]?.completed)
    ).length;
    
    // Update counts but keep XP, level, and streak from backend
    setUserStats(prev => ({
      ...prev,
      totalVideosCompleted: completedVideos,
      totalCoursesCompleted: completedCourses
    }));
  };

  const awardXP = (amount: number, reason: string) => {
    setXpGained(amount);
    setTimeout(() => setXpGained(0), 2000);
    
    const newXP = userStats.totalXP + amount;
    const newLevel = Math.floor(newXP / 100) + 1;
    const leveledUp = newLevel > userStats.level;
    
    const newStats = {
      ...userStats,
      totalXP: newXP,
      level: newLevel
    };
    
    saveUserData(newStats);
    
    if (leveledUp) {
      checkAchievements({ ...newStats, reason: 'level-up' });
    }
  };

  const checkAchievements = (context: any) => {
    const updates: Achievement[] = [...achievements];
    let hasNewAchievement = false;

    updates.forEach(achievement => {
      if (achievement.unlocked) return;

      let shouldUnlock = false;
      
      switch (achievement.id) {
        case "first-video":
          shouldUnlock = userStats.totalVideosCompleted >= 1;
          break;
        case "5-videos":
          shouldUnlock = userStats.totalVideosCompleted >= 5;
          break;
        case "10-videos":
          shouldUnlock = userStats.totalVideosCompleted >= 10;
          break;
        case "first-course":
          shouldUnlock = userStats.totalCoursesCompleted >= 1;
          break;
        case "3-day-streak":
          shouldUnlock = userStats.currentStreak >= 3;
          break;
        case "7-day-streak":
          shouldUnlock = userStats.currentStreak >= 7;
          break;
        case "level-5":
          shouldUnlock = userStats.level >= 5;
          break;
        case "level-10":
          shouldUnlock = userStats.level >= 10;
          break;
        case "night-owl":
          if (context.reason === 'video-complete') {
            const hour = new Date().getHours();
            shouldUnlock = hour >= 22 || hour < 6;
          }
          break;
        case "early-bird":
          if (context.reason === 'video-complete') {
            const hour = new Date().getHours();
            shouldUnlock = hour >= 5 && hour < 7;
          }
          break;
      }

      if (shouldUnlock) {
        achievement.unlocked = true;
        achievement.unlockedAt = new Date().toISOString();
        hasNewAchievement = true;
        setNewAchievement(achievement);
        setTimeout(() => setNewAchievement(null), 4000);
        awardXP(50, `Achievement: ${achievement.title}`);
      }
    });

    if (hasNewAchievement) {
      setAchievements(updates);
      // Save to backend
      axios.post(`${API}/gamification/achievements`, updates).catch(console.error);
    }
  };

  const loadAllProgress = async () => {
    try {
      const res = await axios.get(`${API}/progress`);
      setAllProgress(res.data);
      return res.data;
    } catch (error) {
      console.error("Failed to load progress:", error);
      return {};
    }
  };

  // Recalculate stats when progress or courses change
  useEffect(() => {
    if (courses.length > 0 && Object.keys(allProgress).length > 0) {
      calculateUserStats(courses);
    }
  }, [allProgress, courses]);

  const loadCourse = (course: Course) => {
    setSelectedCourse(course);
    let videoToPlay = course.videos[0] || null;
    let mostRecentVideo = null;
    let mostRecentTime = 0;
    
    course.videos.forEach(video => {
      const progress = allProgress[video.id];
      if (progress && !progress.completed && progress.lastUpdated) {
        const updateTime = new Date(progress.lastUpdated).getTime();
        if (updateTime > mostRecentTime) {
          mostRecentTime = updateTime;
          mostRecentVideo = video;
        }
      }
    });
    
    if (mostRecentVideo) {
      videoToPlay = mostRecentVideo;
    } else {
      const firstIncomplete = course.videos.find(video => !allProgress[video.id]?.completed);
      if (firstIncomplete) {
        videoToPlay = firstIncomplete;
      }
    }
    
    setSelectedVideo(videoToPlay);
    setShowPDF(false);
  };

  const loadVideoProgress = async (videoId: number) => {
    try {
      const res = await axios.get(`${API}/progress/${videoId}`);
      return res.data;
    } catch (error) {
      return { currentTime: 0, duration: 0, completed: false };
    }
  };

  const saveVideoProgress = async (videoId: number, currentTime: number, duration: number) => {
    try {
      const wasCompleted = allProgress[videoId]?.completed || false;
      const completed = duration > 0 && currentTime / duration > 0.9;
      const lastUpdated = new Date().toISOString();
      
      await axios.post(`${API}/progress/${videoId}`, {
        currentTime, duration, completed, lastUpdated
      });
      
      setAllProgress(prev => ({
        ...prev,
        [videoId]: { currentTime, duration, completed, lastUpdated }
      }));

      if (completed && !wasCompleted) {
        const today = new Date().toDateString();
        const lastActivity = userStats.lastActivityDate ? new Date(userStats.lastActivityDate).toDateString() : null;
        
        let newStreak = userStats.currentStreak;
        if (lastActivity !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toDateString();
          
          if (lastActivity === yesterdayStr || !lastActivity) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }
        
        const newStats = {
          ...userStats,
          totalVideosCompleted: userStats.totalVideosCompleted + 1,
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, userStats.longestStreak),
          lastActivityDate: new Date().toISOString()
        };
        
        saveUserData(newStats);
        awardXP(25, "Video completed");
        checkAchievements({ ...newStats, reason: 'video-complete' });
        
        if (selectedCourse) {
          const allVideosCompleted = selectedCourse.videos.every(v => 
            v.id === videoId ? true : allProgress[v.id]?.completed
          );
          
          if (allVideosCompleted) {
            const updatedStats = {
              ...newStats,
              totalCoursesCompleted: newStats.totalCoursesCompleted + 1
            };
            saveUserData(updatedStats);
            awardXP(100, "Course completed!");
            checkAchievements({ ...updatedStats, reason: 'course-complete' });
          }
        }
      }
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      if (saveIntervalRef.current) clearTimeout(saveIntervalRef.current);
      if (selectedVideo && videoRef.current.currentTime > 0) {
        saveIntervalRef.current = setTimeout(() => {
          saveVideoProgress(selectedVideo.id, videoRef.current!.currentTime, videoRef.current!.duration);
        }, 2000);
      }
    }
  };

  const handleLoadedMetadata = async () => {
    if (videoRef.current && selectedVideo) {
      const progress = await loadVideoProgress(selectedVideo.id);
      if (progress.currentTime > 5 && progress.currentTime < progress.duration - 10) {
        videoRef.current.currentTime = progress.currentTime;
      }
    }
  };

  useEffect(() => {
    if (selectedVideo && videoRef.current) {
      const video = videoRef.current;
      const handleEnded = () => {
        if (selectedVideo) {
          saveVideoProgress(selectedVideo.id, video.duration, video.duration);
        }
      };

      video.addEventListener('ended', handleEnded);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.load();

      return () => {
        if (video.currentTime > 0 && video.duration > 0 && selectedVideo) {
          saveVideoProgress(selectedVideo.id, video.currentTime, video.duration);
        }
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        if (saveIntervalRef.current) clearTimeout(saveIntervalRef.current);
      };
    }
  }, [selectedVideo]);

  const getVideoProgress = (videoId: number): number => {
    const progress = allProgress[videoId];
    if (!progress || !progress.duration) return 0;
    return (progress.currentTime / progress.duration) * 100;
  };

  const isVideoCompleted = (videoId: number): boolean => {
    return allProgress[videoId]?.completed || false;
  };

  const getCourseProgress = (course: Course): number => {
    if (!course.videos.length) return 0;
    const completed = course.videos.filter(v => isVideoCompleted(v.id)).length;
    return (completed / course.videos.length) * 100;
  };

  const getLevelProgress = () => {
    const xpInCurrentLevel = userStats.totalXP % 100;
    return xpInCurrentLevel;
  };

  if (!selectedCourse) {
    return (
      <div className={darkMode ? "min-h-screen bg-slate-950" : "min-h-screen bg-slate-50"}>
        {/* XP Notification */}
        {xpGained > 0 && (
          <div className="fixed top-24 right-8 z-50 animate-bounce">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold">
              <Zap className="w-5 h-5" fill="white" />
              +{xpGained} XP
            </div>
          </div>
        )}

        {/* Achievement Notification */}
        {newAchievement && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-2xl shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{newAchievement.icon}</div>
                <div>
                  <div className="text-sm opacity-90">Achievement Unlocked!</div>
                  <div className="text-xl font-bold">{newAchievement.title}</div>
                  <div className="text-sm opacity-75">{newAchievement.description}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className={darkMode ? "bg-slate-900 border-b border-slate-800 sticky top-0 z-10" : "bg-white border-b border-slate-200 sticky top-0 z-10"}>
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className={darkMode ? "text-xl font-bold text-white" : "text-xl font-bold text-slate-900"}>LearnQuest</h1>
                  <p className={darkMode ? "text-xs text-slate-400" : "text-xs text-slate-500"}>Level Up Your Skills</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Level Badge */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-xl shadow-lg">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5" />
                      <span className="font-bold">Level {userStats.level}</span>
                    </div>
                  </div>
                  <div className={darkMode ? "absolute -bottom-2 left-0 right-0 h-1.5 bg-slate-800 rounded-full overflow-hidden" : "absolute -bottom-2 left-0 right-0 h-1.5 bg-slate-200 rounded-full overflow-hidden"}>
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                      style={{ width: `${getLevelProgress()}%` }}
                    />
                  </div>
                </div>

                {/* Streak */}
                <div className={darkMode ? "bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl" : "bg-white border border-slate-200 px-4 py-2 rounded-xl"}>
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className={darkMode ? "font-bold text-white" : "font-bold text-slate-900"}>{userStats.currentStreak}</span>
                    <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>day streak</span>
                  </div>
                </div>

                {/* Achievements Button */}
                <button
                  onClick={() => setShowAchievements(true)}
                  className={darkMode ? "p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 relative" : "p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 relative"}
                >
                  <Award className="w-5 h-5 text-purple-500" />
                  {achievements.filter(a => a.unlocked).length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {achievements.filter(a => a.unlocked).length}
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={darkMode ? "p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700" : "p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"}
                >
                  {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div className={darkMode ? "bg-slate-900 border-b border-slate-800" : "bg-white border-b border-slate-200"}>
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className={darkMode ? "bg-slate-800 border border-slate-700 rounded-xl p-4" : "bg-slate-50 border border-slate-200 rounded-xl p-4"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className={darkMode ? "text-2xl font-bold text-white" : "text-2xl font-bold text-slate-900"}>{userStats.totalXP}</div>
                    <div className={darkMode ? "text-xs text-slate-400" : "text-xs text-slate-600"}>Total XP</div>
                  </div>
                </div>
              </div>

              <div className={darkMode ? "bg-slate-800 border border-slate-700 rounded-xl p-4" : "bg-slate-50 border border-slate-200 rounded-xl p-4"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className={darkMode ? "text-2xl font-bold text-white" : "text-2xl font-bold text-slate-900"}>{userStats.totalVideosCompleted}</div>
                    <div className={darkMode ? "text-xs text-slate-400" : "text-xs text-slate-600"}>Videos Completed</div>
                  </div>
                </div>
              </div>

              <div className={darkMode ? "bg-slate-800 border border-slate-700 rounded-xl p-4" : "bg-slate-50 border border-slate-200 rounded-xl p-4"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className={darkMode ? "text-2xl font-bold text-white" : "text-2xl font-bold text-slate-900"}>{userStats.totalCoursesCompleted}</div>
                    <div className={darkMode ? "text-xs text-slate-400" : "text-xs text-slate-600"}>Courses Completed</div>
                  </div>
                </div>
              </div>

              <div className={darkMode ? "bg-slate-800 border border-slate-700 rounded-xl p-4" : "bg-slate-50 border border-slate-200 rounded-xl p-4"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <div className={darkMode ? "text-2xl font-bold text-white" : "text-2xl font-bold text-slate-900"}>{userStats.longestStreak}</div>
                    <div className={darkMode ? "text-xs text-slate-400" : "text-xs text-slate-600"}>Longest Streak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-10">
            <h2 className={darkMode ? "text-4xl font-bold text-white mb-3" : "text-4xl font-bold text-slate-900 mb-3"}>My Courses</h2>
            <p className={darkMode ? "text-lg text-slate-400" : "text-lg text-slate-600"}>Continue your learning journey</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const progress = getCourseProgress(course);
              const completedCount = course.videos.filter(v => isVideoCompleted(v.id)).length;
              const isCompleted = completedCount === course.videos.length;
              
              return (
                <div
                  key={course.id}
                  onClick={() => loadCourse(course)}
                  className={darkMode 
                    ? "group bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 cursor-pointer overflow-hidden"
                    : "group bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                  }
                >
                  {/* Course Header */}
                  <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10"></div>
                    {isCompleted && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        Completed
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Course Body */}
                  <div className="p-6">
                    <h3 className={darkMode 
                      ? "text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors"
                      : "text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors"
                    }>
                      {course.title}
                    </h3>

                    <div className={darkMode ? "flex items-center gap-4 text-sm text-slate-400 mb-4" : "flex items-center gap-4 text-sm text-slate-600 mb-4"}>
                      <div className="flex items-center gap-1">
                        <Video className="w-4 h-4" />
                        <span>{course.videos.length} lessons</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span>{course.videos.length * 25} XP</span>
                      </div>
                    </div>

                    {progress > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className={darkMode ? "text-slate-400" : "text-slate-600"}>{completedCount} / {course.videos.length} completed</span>
                          <span className="font-semibold text-indigo-600">{Math.round(progress)}%</span>
                        </div>
                        <div className={darkMode ? "h-2 bg-slate-800 rounded-full overflow-hidden" : "h-2 bg-slate-100 rounded-full overflow-hidden"}>
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <button className="mt-4 w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer">
                          <Play className="w-4 h-4" fill="white" />
                          Continue Learning
                        </button>
                      </div>
                    ) : (
                      <button className="mt-2 w-full py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-medium rounded-xl transition-colors">
                        Start Course
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Achievements Modal */}
        {showAchievements && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowAchievements(false)}>
            <div 
              className={darkMode ? "bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" : "bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-white" />
                    <div>
                      <h2 className="text-2xl font-bold text-white">Achievements</h2>
                      <p className="text-purple-100">
                        {achievements.filter(a => a.unlocked).length} of {achievements.length} unlocked
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAchievements(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-5 rounded-xl border-2 transition-all ${
                        achievement.unlocked
                          ? darkMode
                            ? "bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500"
                            : "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300"
                          : darkMode
                          ? "bg-slate-800 border-slate-700 opacity-60"
                          : "bg-slate-50 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`text-4xl ${!achievement.unlocked && 'grayscale opacity-50'}`}>
                          {achievement.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className={darkMode ? "font-bold text-white mb-1" : "font-bold text-slate-900 mb-1"}>
                            {achievement.title}
                          </h3>
                          <p className={darkMode ? "text-sm text-slate-400 mb-2" : "text-sm text-slate-600 mb-2"}>
                            {achievement.description}
                          </p>
                          {achievement.unlocked && achievement.unlockedAt && (
                            <div className="flex items-center gap-2 text-xs text-purple-500 font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                            </div>
                          )}
                          {!achievement.unlocked && (
                            <div className={darkMode ? "text-xs text-slate-500" : "text-xs text-slate-400"}>
                              🔒 Locked
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentIndex = selectedCourse.videos.findIndex(v => v.id === selectedVideo?.id);
  const courseProgress = getCourseProgress(selectedCourse);

  return (
    <div className={darkMode ? "flex h-screen bg-slate-950" : "flex h-screen bg-slate-50"}>
      {/* XP Notification */}
      {xpGained > 0 && (
        <div className="fixed top-24 right-8 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold">
            <Zap className="w-5 h-5" fill="white" />
            +{xpGained} XP
          </div>
        </div>
      )}

      {/* Achievement Notification */}
      {newAchievement && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{newAchievement.icon}</div>
              <div>
                <div className="text-sm opacity-90">Achievement Unlocked!</div>
                <div className="text-xl font-bold">{newAchievement.title}</div>
                <div className="text-sm opacity-75">{newAchievement.description}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} ${darkMode ? 'bg-slate-900 border-r border-slate-800' : 'bg-white border-r border-slate-200'} transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className={darkMode ? "p-6 border-b border-slate-800" : "p-6 border-b border-slate-200"}>
          <button
            onClick={() => setSelectedCourse(null)}
            className={darkMode ? "flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors" : "flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"}
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Courses</span>
          </button>
          <h2 className={darkMode ? "text-lg font-bold text-white mb-2" : "text-lg font-bold text-slate-900 mb-2"}>{selectedCourse.title}</h2>
          <div className={darkMode ? "flex items-center gap-2 text-sm text-slate-400 mb-4" : "flex items-center gap-2 text-sm text-slate-600 mb-4"}>
            <Clock className="w-4 h-4" />
            <span>{selectedCourse.videos.length} lessons</span>
            <span>•</span>
            <Zap className="w-4 h-4 text-yellow-500" />
            <span>{selectedCourse.videos.length * 25} XP</span>
          </div>
          {courseProgress > 0 && (
            <div className="mt-4">
              <div className={darkMode ? "flex justify-between text-xs text-slate-400 mb-1" : "flex justify-between text-xs text-slate-600 mb-1"}>
                <span>Progress</span>
                <span className="font-semibold text-indigo-600">{Math.round(courseProgress)}%</span>
              </div>
              <div className={darkMode ? "h-1.5 bg-slate-800 rounded-full overflow-hidden" : "h-1.5 bg-slate-100 rounded-full overflow-hidden"}>
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600"
                  style={{ width: `${courseProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {selectedCourse.videos.map((video, index) => {
              const progress = getVideoProgress(video.id);
              const isActive = selectedVideo?.id === video.id;
              const isCompleted = isVideoCompleted(video.id);
              
              return (
                <button
                  key={video.id}
                  onClick={() => {
                    setSelectedVideo(video);
                    setShowPDF(false);
                  }}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 relative group ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg"
                      : darkMode
                      ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isCompleted
                        ? "bg-green-500 text-white"
                        : darkMode
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-200 text-slate-600"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Video className={`w-4 h-4 ${isActive ? 'text-white' : 'text-indigo-600'}`} />
                        <h4 className={`font-medium text-sm ${
                          isActive ? "text-white" : darkMode ? "text-white" : "text-slate-900"
                        }`}>
                          {video.title}
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCompleted && (
                          <span className={`text-xs font-medium ${isActive ? 'text-green-200' : 'text-green-600'}`}>
                            ✓ +25 XP earned
                          </span>
                        )}
                        {!isCompleted && progress > 0 && (
                          <span className={`text-xs ${isActive ? 'text-white/80' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {Math.round(progress)}% watched
                          </span>
                        )}
                        {!isCompleted && progress === 0 && (
                          <span className={`text-xs ${isActive ? 'text-white/60' : darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            +25 XP available
                          </span>
                        )}
                        {video.pdf && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isActive 
                              ? 'bg-white/20 text-white'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            <FileText className="w-3 h-3" />
                            PDF
                          </span>
                        )}
                      </div>

                      {progress > 0 && !isCompleted && (
                        <div className={`mt-2 h-1 rounded-full overflow-hidden ${isActive ? 'bg-white/20' : 'bg-slate-200'}`}>
                          <div 
                            className={isActive ? 'h-full bg-white' : 'h-full bg-indigo-500'}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className={darkMode ? "bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between" : "bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between"}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={darkMode ? "p-2 hover:bg-slate-800 rounded-lg transition-colors" : "p-2 hover:bg-slate-100 rounded-lg transition-colors"}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Video className="w-5 h-5 text-indigo-600" />
                <h1 className={darkMode ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>{selectedVideo?.title || 'Select a lesson'}</h1>
              </div>
              <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-500"}>{selectedCourse.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Level Badge */}
            <div className="relative">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-xl shadow-lg">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  <span className="font-bold text-sm">Level {userStats.level}</span>
                </div>
              </div>
            </div>

            {/* Streak */}
            <div className={darkMode ? "bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl" : "bg-white border border-slate-200 px-3 py-2 rounded-xl"}>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className={darkMode ? "font-bold text-white text-sm" : "font-bold text-slate-900 text-sm"}>{userStats.currentStreak}</span>
              </div>
            </div>

            <button
              onClick={() => setShowAchievements(true)}
              className={darkMode ? "p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 relative" : "p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 relative"}
            >
              <Award className="w-5 h-5 text-purple-500" />
              {achievements.filter(a => a.unlocked).length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {achievements.filter(a => a.unlocked).length}
                </div>
              )}
            </button>
            
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={darkMode ? "p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700" : "p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"}
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </header>

        {/* Video Player Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Section */}
          <div className="flex-1 bg-slate-950 overflow-y-auto">
            {selectedVideo ? (
              <div className="p-6">
                {/* Video Player */}
                <div className="max-w-6xl mx-auto mb-6">
                  <video
                    ref={videoRef}
                    key={`${selectedCourse.id}-${selectedVideo.id}`}
                    controls
                    className="w-full rounded-xl shadow-2xl"
                    style={{ maxHeight: '70vh' }}
                  >
                    <source
                      src={`${API}/stream/${encodeURIComponent(
                        selectedCourse.title
                      )}/${encodeURIComponent(selectedVideo.filePath)}`}
                      type="video/mp4"
                    />
                  </video>
                </div>

                {/* PDF Section Below Video */}
                {selectedVideo.pdf && (
                  <div className="max-w-6xl mx-auto">
                    <div className={darkMode ? "bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden" : "bg-white rounded-2xl border border-slate-200 overflow-hidden"}>
                      {/* PDF Header */}
                      <div className={darkMode ? "p-4 border-b border-slate-800 bg-slate-800" : "p-4 border-b border-slate-200 bg-blue-50"}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className={darkMode ? "font-semibold text-white" : "font-semibold text-slate-900"}>
                                Course Notes & Materials
                              </h3>
                              <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>
                                {selectedVideo.pdf.title}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowPDF(!showPDF)}
                            className={darkMode 
                              ? "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                              : "px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                            }
                          >
                            {showPDF ? 'Hide PDF' : 'Show PDF'}
                          </button>
                        </div>
                      </div>

                      {/* PDF Viewer */}
                      {showPDF && (
                        <div className={darkMode ? "bg-slate-950" : "bg-slate-100"}>
                          <iframe
                            key={`pdf-${selectedVideo.pdf.id}`}
                            src={`${API}/pdf/${encodeURIComponent(
                              selectedCourse.title
                            )}/${encodeURIComponent(selectedVideo.pdf.filePath)}#view=FitH`}
                            className="w-full"
                            style={{ height: '80vh' }}
                            title={selectedVideo.pdf.title}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No PDF Message */}
                {!selectedVideo.pdf && (
                  <div className="max-w-6xl mx-auto">
                    <div className={darkMode ? "bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center" : "bg-white border border-slate-200 rounded-2xl p-8 text-center"}>
                      <FileText className={darkMode ? "w-12 h-12 text-slate-700 mx-auto mb-3" : "w-12 h-12 text-slate-300 mx-auto mb-3"} />
                      <p className={darkMode ? "text-slate-400" : "text-slate-600"}>
                        No PDF materials available for this lesson
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4">
                    <Play className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-slate-400">Select a lesson to start learning</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Controls */}
          {selectedVideo && (
            <div className={darkMode ? "bg-slate-900 border-t border-slate-800 p-6" : "bg-white border-t border-slate-200 p-6"}>
              <div className="max-w-7xl mx-auto">
                {/* Navigation Buttons */}
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={() => {
                      if (currentIndex > 0) {
                        const prevVideo = selectedCourse.videos[currentIndex - 1];
                        setSelectedVideo(prevVideo ?? null);
                        setShowPDF(false);
                      }
                    }}
                    disabled={currentIndex <= 0}
                    className={darkMode 
                      ? "px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2 border border-slate-700"
                      : "px-6 py-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-medium rounded-xl transition-all flex items-center gap-2 border border-slate-200"
                    }
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous Lesson
                  </button>

                  <div className={darkMode ? "text-center px-6 py-3 bg-slate-800 rounded-xl border border-slate-700" : "text-center px-6 py-3 bg-slate-50 rounded-xl border border-slate-200"}>
                    <span className={darkMode ? "text-slate-400 text-sm" : "text-slate-500 text-sm"}>Lesson </span>
                    <span className={darkMode ? "font-bold text-white text-lg" : "font-bold text-slate-900 text-lg"}>{currentIndex + 1}</span>
                    <span className={darkMode ? "text-slate-400 text-sm" : "text-slate-500 text-sm"}> of {selectedCourse.videos.length}</span>
                  </div>

                  <button
                    onClick={() => {
                      if (currentIndex >= 0 && currentIndex < selectedCourse.videos.length - 1) {
                        const nextVideo = selectedCourse.videos[currentIndex + 1];
                        setSelectedVideo(nextVideo ?? null);
                        setShowPDF(false);
                      }
                    }}
                    disabled={currentIndex < 0 || currentIndex >= selectedCourse.videos.length - 1}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                  >
                    Next Lesson
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowAchievements(false)}>
          <div 
            className={darkMode ? "bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" : "bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="w-8 h-8 text-white" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Achievements</h2>
                    <p className="text-purple-100">
                      {achievements.filter(a => a.unlocked).length} of {achievements.length} unlocked
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAchievements(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`p-5 rounded-xl border-2 transition-all ${
                      achievement.unlocked
                        ? darkMode
                          ? "bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500"
                          : "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300"
                        : darkMode
                        ? "bg-slate-800 border-slate-700 opacity-60"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`text-4xl ${!achievement.unlocked && 'grayscale opacity-50'}`}>
                        {achievement.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className={darkMode ? "font-bold text-white mb-1" : "font-bold text-slate-900 mb-1"}>
                          {achievement.title}
                        </h3>
                        <p className={darkMode ? "text-sm text-slate-400 mb-2" : "text-sm text-slate-600 mb-2"}>
                          {achievement.description}
                        </p>
                        {achievement.unlocked && achievement.unlockedAt && (
                          <div className="flex items-center gap-2 text-xs text-purple-500 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                          </div>
                        )}
                        {!achievement.unlocked && (
                          <div className={darkMode ? "text-xs text-slate-500" : "text-xs text-slate-400"}>
                            🔒 Locked
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}