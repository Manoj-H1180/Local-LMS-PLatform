"use client";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Play, BookOpen, Video, CheckCircle2, FileText, Clock, Award, Home, Menu, X, Sun, Moon, Trophy, Zap, Flame, Crown, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Settings, StickyNote, Plus, Trash2, BarChart3, Target, TrendingUp, Calendar } from "lucide-react";

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

interface Note {
  id: number;
  timestamp: number;
  content: string;
  createdAt: string;
}

interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  completed: boolean;
}

interface Analytics {
  totalWatchTime: number;
  dailyStats: Record<string, { watchTime: number; videosCompleted: number }>;
  courseStats: Record<string, { watchTime: number; videosCompleted: number }>;
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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
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

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [analytics, setAnalytics] = useState<Analytics>({ totalWatchTime: 0, dailyStats: {}, courseStats: {} });
  const [quests, setQuests] = useState<Quest[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      await loadUserData();
      await loadAllProgress();
      await loadAnalytics();
      await loadQuests();

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
      const statsRes = await axios.get(`${API}/gamification/stats`);
      const stats = statsRes.data;
      setUserStats(stats);
      updateStreak(stats);

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

  const loadAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/analytics`);
      setAnalytics(res.data);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    }
  };

  const loadQuests = async () => {
    try {
      const res = await axios.get(`${API}/quests`);
      setQuests(res.data.dailyQuests);
    } catch (error) {
      console.error("Failed to load quests:", error);
    }
  };

  const loadNotes = async (videoId: number) => {
    try {
      const res = await axios.get(`${API}/notes/${videoId}`);
      setNotes(res.data);
    } catch (error) {
      console.error("Failed to load notes:", error);
    }
  };

  const addNote = async () => {
    if (!selectedVideo || !newNoteContent.trim()) return;

    try {
      const timestamp = videoRef.current?.currentTime || 0;
      await axios.post(`${API}/notes/${selectedVideo.id}`, {
        timestamp,
        content: newNoteContent
      });
      setNewNoteContent("");
      await loadNotes(selectedVideo.id);
    } catch (error) {
      console.error("Failed to add note:", error);
    }
  };

  const deleteNote = async (noteId: number) => {
    if (!selectedVideo) return;

    try {
      await axios.delete(`${API}/notes/${selectedVideo.id}/${noteId}`);
      await loadNotes(selectedVideo.id);
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const seekToNote = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
    }
  };

  const updateQuestProgress = async (questId: string, increment: number = 1) => {
    try {
      const res = await axios.post(`${API}/quests/progress`, { questId, increment });
      setQuests(res.data.quests.dailyQuests);

      const quest = res.data.quests.dailyQuests.find((q: Quest) => q.id === questId);
      if (quest && quest.completed && quest.progress === quest.target) {
        awardXP(quest.reward, `Quest completed: ${quest.title}`);
      }
    } catch (error) {
      console.error("Failed to update quest:", error);
    }
  };

  const trackWatchTime = async (duration: number) => {
    if (!selectedVideo || !selectedCourse) return;

    try {
      await axios.post(`${API}/analytics/watch-time`, {
        duration,
        videoId: selectedVideo.id,
        courseId: selectedCourse.id
      });
      await loadAnalytics();

      updateQuestProgress('study-30', Math.floor(duration / 60));
    } catch (error) {
      console.error("Failed to track watch time:", error);
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

        updateQuestProgress('watch-1');
        updateQuestProgress('watch-3');

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
      setCurrentTime(videoRef.current.currentTime);

      const now = Date.now();
      const elapsed = (now - lastUpdateRef.current) / 1000;
      if (elapsed > 0 && elapsed < 5) {
        watchTimeRef.current += elapsed;
        if (watchTimeRef.current >= 30) {
          trackWatchTime(watchTimeRef.current);
          watchTimeRef.current = 0;
        }
      }
      lastUpdateRef.current = now;

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
      setDuration(videoRef.current.duration);
      const progress = await loadVideoProgress(selectedVideo.id);
      if (progress.currentTime > 5 && progress.currentTime < progress.duration - 10) {
        videoRef.current.currentTime = progress.currentTime;
        setCurrentTime(progress.currentTime);
      }
      await loadNotes(selectedVideo.id);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(videoRef.current.volume || 0.5);
      }
    }
  };

  const toggleFullscreen = () => {
    const videoContainer = document.getElementById('video-container');
    if (!videoContainer) return;

    if (!isFullscreen) {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleSeek = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skipForward = () => {
    if (videoRef.current) {
      const newTime = Math.min(videoRef.current.currentTime + 10, duration);
      handleSeek(newTime);
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      const newTime = Math.max(videoRef.current.currentTime - 10, 0);
      handleSeek(newTime);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const getWeeklyData = () => {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const dayData = analytics.dailyStats[dateStr] || { watchTime: 0, videosCompleted: 0 };
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        time: Math.round(dayData.watchTime / 60),
        videos: dayData.videosCompleted
      });
    }

    return days;
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          skipForward();
          break;
        case 'ArrowLeft':
          skipBackward();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, duration]);

  useEffect(() => {
    if (selectedVideo && videoRef.current) {
      const video = videoRef.current;
      const handleEnded = () => {
        if (selectedVideo) {
          saveVideoProgress(selectedVideo.id, video.duration, video.duration);
          setIsPlaying(false);
        }
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      video.addEventListener('ended', handleEnded);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.load();

      return () => {
        if (video.currentTime > 0 && video.duration > 0 && selectedVideo) {
          saveVideoProgress(selectedVideo.id, video.currentTime, video.duration);
          if (watchTimeRef.current > 0) {
            trackWatchTime(watchTimeRef.current);
          }
        }
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        if (saveIntervalRef.current) clearTimeout(saveIntervalRef.current);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
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
        {xpGained > 0 && (
          <div className="fixed top-24 right-8 z-50 animate-bounce">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold">
              <Zap className="w-5 h-5" fill="white" />
              +{xpGained} XP
            </div>
          </div>
        )}

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

                <div className={darkMode ? "bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl" : "bg-white border border-slate-200 px-4 py-2 rounded-xl"}>
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className={darkMode ? "font-bold text-white" : "font-bold text-slate-900"}>{userStats.currentStreak}</span>
                    <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>day streak</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowQuests(true)}
                  className={darkMode ? "p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 relative" : "p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 relative"}
                >
                  <Target className="w-5 h-5 text-green-500" />
                  {quests.filter(q => q.completed).length > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {quests.filter(q => q.completed).length}
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setShowAnalytics(true)}
                  className={darkMode ? "p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700" : "p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"}
                >
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                </button>

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

        {/* Quests Modal */}
        {showQuests && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowQuests(false)}>
            <div
              className={darkMode ? "bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full" : "bg-white border border-slate-200 rounded-2xl max-w-2xl w-full"}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-8 h-8 text-white" />
                    <div>
                      <h2 className="text-2xl font-bold text-white">Daily Quests</h2>
                      <p className="text-green-100">Complete quests to earn bonus XP!</p>
                    </div>
                  </div>
                  <button onClick={() => setShowQuests(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {quests.map((quest) => (
                  <div key={quest.id} className={darkMode ? "bg-slate-800 rounded-xl p-4 border border-slate-700" : "bg-slate-50 rounded-xl p-4 border border-slate-200"}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className={darkMode ? "font-bold text-white" : "font-bold text-slate-900"}>{quest.title}</h3>
                        <p className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>{quest.description}</p>
                      </div>
                      <div className="text-yellow-500 font-bold">+{quest.reward} XP</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={darkMode ? "flex-1 h-2 bg-slate-700 rounded-full overflow-hidden" : "flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"}>
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                          style={{ width: `${(quest.progress / quest.target) * 100}%` }}
                        />
                      </div>
                      <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>
                        {quest.progress}/{quest.target}
                      </span>
                      {quest.completed && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Modal */}
        {showAnalytics && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowAnalytics(false)}>
            <div
              className={darkMode ? "bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-auto" : "bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-auto"}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-white" />
                    <div>
                      <h2 className="text-2xl font-bold text-white">Learning Analytics</h2>
                      <p className="text-blue-100">Track your progress and study patterns</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className={darkMode ? "bg-slate-800 rounded-xl p-4 border border-slate-700" : "bg-slate-50 rounded-xl p-4 border border-slate-200"}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>Total Watch Time</span>
                    </div>
                    <div className={darkMode ? "text-3xl font-bold text-white" : "text-3xl font-bold text-slate-900"}>
                      {formatDuration(analytics.totalWatchTime / 60)}
                    </div>
                  </div>
                  <div className={darkMode ? "bg-slate-800 rounded-xl p-4 border border-slate-700" : "bg-slate-50 rounded-xl p-4 border border-slate-200"}>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-green-500" />
                      <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>This Week</span>
                    </div>
                    <div className={darkMode ? "text-3xl font-bold text-white" : "text-3xl font-bold text-slate-900"}>
                      {formatDuration(getWeeklyData().reduce((sum, day) => sum + day.time, 0))}
                    </div>
                  </div>
                  <div className={darkMode ? "bg-slate-800 rounded-xl p-4 border border-slate-700" : "bg-slate-50 rounded-xl p-4 border border-slate-200"}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-purple-500" />
                      <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>Avg/Day</span>
                    </div>
                    <div className={darkMode ? "text-3xl font-bold text-white" : "text-3xl font-bold text-slate-900"}>
                      {formatDuration(getWeeklyData().reduce((sum, day) => sum + day.time, 0) / 7)}
                    </div>
                  </div>
                </div>

                <h3 className={darkMode ? "text-lg font-bold text-white mb-4" : "text-lg font-bold text-slate-900 mb-4"}>📅 Weekly Activity</h3>
                <div className="flex items-end justify-between gap-2 h-48">
                  {getWeeklyData().map((day, i) => {
                    const maxTime = Math.max(...getWeeklyData().map(d => d.time), 1);
                    const height = (day.time / maxTime) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="relative group w-full">
                          <div
                            className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all hover:from-indigo-500 hover:to-indigo-300 cursor-pointer"
                            style={{ height: `${Math.max(height, 8)}%`, minHeight: '8px' }}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {day.time}m · {day.videos} videos
                          </div>
                        </div>
                        <span className={darkMode ? "text-xs text-slate-400 font-medium" : "text-xs text-slate-600 font-medium"}>{day.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

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
                      className={`p-5 rounded-xl border-2 transition-all ${achievement.unlocked
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
      {xpGained > 0 && (
        <div className="fixed top-24 right-8 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold">
            <Zap className="w-5 h-5" fill="white" />
            +{xpGained} XP
          </div>
        </div>
      )}

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
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 relative group ${isActive
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg"
                      : darkMode
                        ? "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                        : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${isActive
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
                        <h4 className={`font-medium text-sm ${isActive ? "text-white" : darkMode ? "text-white" : "text-slate-900"
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
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isActive
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

      <main className="flex-1 flex flex-col overflow-hidden">
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
            <div className="relative">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-xl shadow-lg">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  <span className="font-bold text-sm">Level {userStats.level}</span>
                </div>
              </div>
            </div>

            <div className={darkMode ? "bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl" : "bg-white border border-slate-200 px-3 py-2 rounded-xl"}>
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className={darkMode ? "font-bold text-white text-sm" : "font-bold text-slate-900 text-sm"}>{userStats.currentStreak}</span>
              </div>
            </div>

            <button
              onClick={() => setShowNotes(!showNotes)}
              className={darkMode ? "p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700" : "p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"}
            >
              <StickyNote className="w-5 h-5 text-yellow-500" />
            </button>

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

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 bg-slate-950 overflow-y-auto">
            {selectedVideo ? (
              <div className="p-6">
                <div className="max-w-6xl mx-auto mb-6">
                  <div
                    id="video-container"
                    className="relative bg-black rounded-xl overflow-hidden shadow-2xl group"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => isPlaying && setShowControls(false)}
                  >
                    <video
                      ref={videoRef}
                      key={`${selectedCourse.id}-${selectedVideo.id}`}
                      className="w-full"
                      style={{ maxHeight: '70vh' }}
                      onClick={togglePlayPause}
                    >
                      <source
                        src={`${API}/stream/${encodeURIComponent(
                          selectedCourse.title
                        )}/${encodeURIComponent(selectedVideo.filePath)}`}
                        type="video/mp4"
                      />
                    </video>

                    {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <button
                          onClick={togglePlayPause}
                          className="w-20 h-20 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transform hover:scale-110 transition-all shadow-2xl"
                        >
                          <Play className="w-10 h-10 text-slate-900 ml-1" fill="currentColor" />
                        </button>
                      </div>
                    )}

                    <div
                      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                      <div className="px-4 pt-8 pb-2">
                        <div
                          className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-2 transition-all"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pos = (e.clientX - rect.left) / rect.width;
                            handleSeek(pos * duration);
                          }}
                        >
                          <div
                            className="absolute h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-4 pb-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={togglePlayPause}
                            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                          >
                            {isPlaying ? (
                              <Pause className="w-5 h-5 text-white" fill="white" />
                            ) : (
                              <Play className="w-5 h-5 text-white" fill="white" />
                            )}
                          </button>

                          <button
                            onClick={skipBackward}
                            className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                          >
                            <SkipBack className="w-4 h-4 text-white" />
                          </button>

                          <button
                            onClick={skipForward}
                            className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                          >
                            <SkipForward className="w-4 h-4 text-white" />
                          </button>

                          <div className="flex items-center gap-2 group/volume">
                            <button
                              onClick={toggleMute}
                              className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                            >
                              {isMuted || volume === 0 ? (
                                <VolumeX className="w-4 h-4 text-white" />
                              ) : (
                                <Volume2 className="w-4 h-4 text-white" />
                              )}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={volume}
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                              className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                            />
                          </div>

                          <div className="text-white text-sm font-medium ml-2">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                              className="px-3 h-9 rounded-lg hover:bg-white/10 flex items-center gap-1 transition-all text-white text-sm font-medium"
                            >
                              <Settings className="w-4 h-4" />
                              {playbackRate}x
                            </button>

                            {showSpeedMenu && (
                              <div className="absolute bottom-full right-0 mb-2 bg-slate-900 rounded-lg shadow-2xl border border-slate-700 overflow-hidden">
                                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                                  <button
                                    key={rate}
                                    onClick={() => changePlaybackRate(rate)}
                                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${playbackRate === rate
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-300 hover:bg-slate-800'
                                      }`}
                                  >
                                    {rate}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={toggleFullscreen}
                            className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                          >
                            {isFullscreen ? (
                              <Minimize className="w-4 h-4 text-white" />
                            ) : (
                              <Maximize className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                {showNotes && (
                  <div className="max-w-6xl mx-auto mb-6">
                    <div className={darkMode ? "bg-slate-900 rounded-2xl border border-slate-800 p-6" : "bg-white rounded-2xl border border-slate-200 p-6"}>
                      <div className="flex items-center gap-2 mb-4">
                        <StickyNote className="w-6 h-6 text-yellow-500" />
                        <h3 className={darkMode ? "text-xl font-bold text-white" : "text-xl font-bold text-slate-900"}>My Notes</h3>
                        <span className={darkMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>({notes.length})</span>
                      </div>

                      <div className="flex gap-2 mb-4">
                        <input
                          type="text"
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addNote()}
                          placeholder="Add a note at current time..."
                          className={darkMode ? "flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500" : "flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 placeholder-slate-400"}
                        />
                        <button
                          onClick={addNote}
                          disabled={!newNoteContent.trim()}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Note
                        </button>
                      </div>

                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {notes.length === 0 ? (
                          <div className={darkMode ? "text-center py-8 text-slate-500" : "text-center py-8 text-slate-400"}>
                            <StickyNote className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No notes yet. Add your first note above!</p>
                          </div>
                        ) : (
                          notes.map((note) => (
                            <div key={note.id} className={darkMode ? "bg-slate-800 rounded-lg p-4 border border-slate-700" : "bg-slate-50 rounded-lg p-4 border border-slate-200"}>
                              <div className="flex justify-between items-start mb-2">
                                <button
                                  onClick={() => seekToNote(note.timestamp)}
                                  className="text-indigo-400 hover:text-indigo-300 font-medium text-sm flex items-center gap-1"
                                >
                                  <Clock className="w-3 h-3" />
                                  {formatTime(note.timestamp)}
                                </button>
                                <button
                                  onClick={() => deleteNote(note.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <p className={darkMode ? "text-slate-300" : "text-slate-700"}>{note.content}</p>
                              <p className={darkMode ? "text-xs text-slate-500 mt-1" : "text-xs text-slate-400 mt-1"}>
                                {new Date(note.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Section */}
                {selectedVideo.pdf && (
                  <div className="max-w-6xl mx-auto">
                    <div className={darkMode ? "bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden" : "bg-white rounded-2xl border border-slate-200 overflow-hidden"}>
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

          {selectedVideo && (
            <div className={darkMode ? "bg-slate-900 border-t border-slate-800 p-6" : "bg-white border-t border-slate-200 p-6"}>
              <div className="max-w-7xl mx-auto">
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
                    className={`p-5 rounded-xl border-2 transition-all ${achievement.unlocked
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