import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, VolumeX, Download, Film, Upload, Trash2 } from 'lucide-react';
import { parseSrt, getMutesFromSubtitles, resolveConflicts, generateEdlString } from './lib/edl';
import type { EdlEntry, SubtitleBlock } from './lib/edl';
import { searchSubtitles, downloadSubtitle } from './lib/opensubtitles';
import type { SubtitleMetadata } from './lib/opensubtitles';
import './index.css';

// Default starter wordlist
const DEFAULT_WORDLIST = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'cock', 'motherfucker', 'crap', 'damn', 'bastard'];

function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [manualCuts, setManualCuts] = useState<EdlEntry[]>([]);
  const [autoMutes, setAutoMutes] = useState<EdlEntry[]>([]);
  const [resolvedEntries, setResolvedEntries] = useState<EdlEntry[]>([]);

  const [markIn, setMarkIn] = useState<number | null>(null);
  const [srtFileName, setSrtFileName] = useState<string | null>(null);
  const [wordlistText, setWordlistText] = useState(DEFAULT_WORDLIST.join('\n'));

  const [subtitleBlocks, setSubtitleBlocks] = useState<SubtitleBlock[]>([]);
  const [srtOffset, setSrtOffset] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SubtitleMetadata[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Generate mutes when subtitle blocks, wordlist, or offset changes
    const currentList = wordlistText.split('\n').map(w => w.trim()).filter(w => w);
    setAutoMutes(getMutesFromSubtitles(subtitleBlocks, currentList, srtOffset));
  }, [subtitleBlocks, wordlistText, srtOffset]);

  useEffect(() => {
    // Generate the final merged list whenever cuts or mutes change
    const combined = [...manualCuts, ...autoMutes];
    setResolvedEntries(resolveConflicts(combined));
  }, [manualCuts, autoMutes]);

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoObjectUrl(URL.createObjectURL(file));
      // Reset state for new video
      setManualCuts([]);
      setAutoMutes([]);
      setMarkIn(null);
      setSrtFileName(null);
      setSubtitleBlocks([]);
      setSrtOffset(0);
      setSearchResults([]);
      setSearchQuery('');
      setSearchError(null);
      setCurrentTime(0);
      setDuration(0);

      // Attempt to pre-fill search based on filename
      const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      // Basic cleanup: remove years in parens, dots, etc to get a cleaner title
      const cleanTitle = base.replace(/\(\d{4}\)/g, '').replace(/\./g, ' ').trim();
      setSearchQuery(cleanTitle);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleScrub = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const handleMarkIn = () => setMarkIn(currentTime);

  const handleMarkOut = () => {
    if (markIn !== null && currentTime > markIn) {
      const newCut: EdlEntry = { start: markIn, end: currentTime, action: 0 };
      setManualCuts([...manualCuts, newCut]);
      setMarkIn(null);
    } else {
      alert("Mark OUT must be after Mark IN");
    }
  };

  const handleLocalSrtLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSrtFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSubtitleBlocks(parseSrt(content));
    };
    reader.readAsText(file);
  };

  const handleSearchSubtitles = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchSubtitles(searchQuery);
      setSearchResults(results);
      if (results.length === 0) setSearchError("No subtitles found for that query.");
    } catch (err: any) {
      setSearchError(err.message || "Failed to search subtitles. Check API configuration.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadAndApply = async (sub: SubtitleMetadata) => {
    setIsDownloading(true);
    setSearchError(null);
    try {
      const textContent = await downloadSubtitle(sub.id);
      setSrtFileName(sub.fileName || 'OpenSubtitles Download');
      setSubtitleBlocks(parseSrt(textContent));
      setSearchResults([]); // close results
    } catch (err: any) {
      setSearchError(err.message || "Failed to download subtitle file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const removeEntry = (index: number, type: 'cut' | 'mute') => {
    if (type === 'cut') {
      const newCuts = [...manualCuts];
      newCuts.splice(index, 1);
      setManualCuts(newCuts);
    }
  };

  const handleDownloadEdl = () => {
    if (resolvedEntries.length === 0) return;
    const edlString = generateEdlString(resolvedEntries);
    const blob = new Blob([edlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;

    // Use video base name if available
    let downloadName = 'movie.edl';
    if (videoFile) {
      const baseName = videoFile.name.substring(0, videoFile.name.lastIndexOf('.')) || videoFile.name;
      downloadName = `${baseName}.edl`;
    }

    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = (secs % 60).toFixed(1);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(4, '0')}`;
    return `${m}:${s.padStart(4, '0')}`;
  };

  return (
    <div className="animate-fade-in">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Film className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>EDL Maker</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>Auto-Mute & Visual Scrubber</p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          disabled={resolvedEntries.length === 0}
          onClick={handleDownloadEdl}
        >
          <Download className="w-4 h-4" />
          Export .EDL ({resolvedEntries.length})
        </button>
      </header>

      {!videoFile ? (
        <div className="card" style={{
          marginTop: '4rem',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderStyle: 'dashed',
          borderWidth: '2px',
          borderColor: 'var(--border-color)',
          backgroundColor: 'rgba(30, 41, 59, 0.3)'
        }}>
          <Upload className="w-16 h-16 text-slate-400 mb-6" />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Select your movie file</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', textAlign: 'center', maxWidth: '400px' }}>
            Choose the local video you want to generate an EDL for. The file stays on your computer and is never uploaded.
          </p>
          <label className="btn btn-primary">
            Browse Files
            <input
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleVideoSelect}
            />
          </label>
        </div>
      ) : (
        <div className="app-grid">
          {/* LEFT COLUMN: Main Video Player & TimeControls */}
          <div className="flex-col gap-4">
            <div className="card">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Film className="text-blue-400" /> Video Editor
              </h2>

              <div className="flex-col gap-2">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                  {videoObjectUrl && (
                    <>
                      <video
                        ref={videoRef}
                        src={videoObjectUrl}
                        controls={false}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />

                      {/* Subtitle Overlay */}
                      <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none px-8">
                        {subtitleBlocks
                          .filter(b => currentTime >= (b.start + srtOffset) && currentTime <= (b.end + srtOffset))
                          .map(b => (
                            <div key={b.id} className="text-center px-4 py-1" style={{
                              background: 'rgba(0, 0, 0, 0.75)',
                              color: 'white',
                              fontSize: 'calc(14px + 1vw)',
                              textShadow: '2px 2px 4px black',
                              borderRadius: '6px',
                              whiteSpace: 'pre-wrap',
                              maxWidth: '100%'
                            }}>
                              {b.text}
                            </div>
                          ))}
                      </div>
                    </>
                  )}

                  {/* Visual marker inside player for Mark IN */}
                  {markIn !== null && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: 'var(--accent-danger)', color: 'white',
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                    }}>
                      IN: {formatTime(markIn)}
                    </div>
                  )}
                </div>

                {duration > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {formatTime(currentTime)}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      step="0.1"
                      value={currentTime}
                      onChange={handleScrub}
                      style={{ flexGrow: 1, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {formatTime(duration)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <button className="btn-icon" onClick={() => jumpTime(-5)} title="Jump Back 5s"><SkipBack className="w-5 h-5" /></button>
                    <button className="btn-icon" onClick={togglePlay} title="Play/Pause">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button className="btn-icon" onClick={() => jumpTime(5)} title="Jump Forward 5s"><SkipForward className="w-5 h-5" /></button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-outline"
                      onClick={handleMarkIn}
                      style={{
                        borderColor: markIn !== null ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        color: markIn !== null ? 'var(--text-primary)' : 'var(--text-secondary)',
                        padding: '0.5rem 1rem'
                      }}
                    >
                      [ Mark IN
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleMarkOut}
                      disabled={markIn === null}
                      style={{
                        borderColor: markIn !== null ? 'var(--accent-danger)' : 'var(--text-secondary)',
                        color: markIn !== null ? 'var(--accent-danger)' : 'var(--text-secondary)',
                        padding: '0.5rem 1rem'
                      }}
                    >
                      Mark OUT ]
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="flex-col gap-4">
              {/* Subtitles & Automation */}
              <div className="card flex-col gap-4">
                <h3 className="flex items-center justify-between" style={{ fontSize: '1.1rem', margin: 0 }}>
                  <span className="flex items-center gap-2">
                    <VolumeX className="w-5 h-5 text-emerald-500" />
                    Auto-Mute Subtitles
                  </span>
                  {srtFileName && <span style={{ fontSize: '0.8rem', color: 'var(--accent-success)' }}>{autoMutes.length} Mutes</span>}
                </h3>

                {!srtFileName ? (
                  <>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Search OpenSubtitles or load a local .srt file to automatically generate audio mutes.
                    </p>

                    {searchError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {searchError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Movie Title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchSubtitles()}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleSearchSubtitles}
                        disabled={isSearching || !searchQuery}
                      >
                        {isSearching ? '...' : 'Search'}
                      </button>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="flex-col gap-2 mt-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {searchResults.map((sub, i) => (
                          <div key={i} className="card flex items-center justify-between" style={{ padding: '0.75rem', margin: 0 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sub.fileName}</span>
                              <br />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub.downloads} DLs | {sub.language}</span>
                            </div>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleDownloadAndApply(sub)}
                              disabled={isDownloading}
                            >
                              Use
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>— OR —</span>
                    </div>
                    <label className="btn btn-outline w-full cursor-pointer justify-center">
                      Load Local .SRT
                      <input type="file" accept=".srt" style={{ display: 'none' }} onChange={handleLocalSrtLoad} />
                    </label>
                  </>
                ) : (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent-success)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ✅ {srtFileName}
                    </p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Automatically generated {autoMutes.length} audio mute points.
                    </p>
                    <button
                      className="btn btn-outline mt-4 w-full justify-center"
                      onClick={() => { setSrtFileName(null); setAutoMutes([]); setSearchResults([]); }}
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    >
                      Clear & Load Different
                    </button>
                  </div>
                )}
              </div>

              {/* EDL Entries List */}
              <div className="card flex-col" style={{ flexGrow: 1, maxHeight: 'calc(100vh - 400px)', overflow: 'hidden' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Resolved EDL</h3>
                  <span style={{ fontSize: '0.8rem', background: 'var(--bg-panel-light)', padding: '2px 8px', borderRadius: '12px' }}>
                    {resolvedEntries.length} Total
                  </span>
                </div>

                <div className="flex-col gap-2" style={{ overflowY: 'auto', paddingRight: '4px' }}>
                  {resolvedEntries.length === 0 ? (
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                      No cuts or mutes added yet.
                    </div>
                  ) : (
                    resolvedEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between" style={{
                        padding: '0.5rem 0.75rem',
                        background: entry.action === 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        borderLeft: `3px solid ${entry.action === 0 ? 'var(--accent-danger)' : 'var(--accent-primary)'}`,
                        borderRadius: '4px'
                      }}>
                        <div className="flex-col">
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: entry.action === 0 ? 'var(--accent-danger)' : 'var(--accent-primary)' }}>
                            {entry.action === 0 ? 'CUT (Video)' : 'MUTE (Audio)'}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                            {formatTime(entry.start)} - {formatTime(entry.end)}
                          </span>
                        </div>

                        {/* Only allow deleting manual cuts (action 0) for now */}
                        {entry.action === 0 && (
                          <button
                            className="btn-icon"
                            onClick={() => {
                              // Find the original manual cut and remove it
                              const manualIdx = manualCuts.findIndex(c => c.start === entry.start && c.end === entry.end);
                              if (manualIdx >= 0) removeEntry(manualIdx, 'cut');
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Wordlist Editor & Sync */}
              <div className="card flex-col gap-2">
                <div className="flex justify-between items-center mb-1">
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Filter Wordlist</h3>

                  {subtitleBlocks.length > 0 && (
                    <div className="flex items-center gap-2" title="Shift subtitles forward or backward in time">
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sync (sec):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={srtOffset}
                        onChange={(e) => setSrtOffset(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '70px',
                          padding: '0.2rem 0.5rem',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid var(--border-color)',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  One word per line.
                </p>
                <textarea
                  className="blur-until-hover"
                  value={wordlistText}
                  onChange={(e) => setWordlistText(e.target.value)}
                  style={{
                    width: '100%',
                    height: '100px',
                    background: 'var(--bg-panel-light)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
