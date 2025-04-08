import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import WaveSurfer from 'wavesurfer.js';
import MicrophonePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.microphone';
import Logo from '../icons/covosLogo.svg';
import { Mic, Pause, Play } from 'lucide-react';

function VoiceCreate() {
  const [isRecording, setIsRecording] = useState(false);
  const [voicePackName, setVoicePackName] = useState('');
  const [timer, setTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState('00:00');
  const [currentTime, setCurrentTime] = useState(0);

  const ffmpegRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const audioStreamRef = useRef(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpeg = createFFmpeg({ log: false });
      await ffmpeg.load();
      ffmpegRef.current = ffmpeg;
      setIsFFmpegLoaded(true);
    };
    loadFFmpeg();
  }, []);

  useEffect(() => {
    if (!waveformRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#a78bfa',
      progressColor: '#7C3AED',
      cursorColor: '#7C3AED',
      barWidth: 2,
      height: 60,
      responsive: true,
      plugins: [MicrophonePlugin.create()],
    });

    wavesurferRef.current.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(wavesurferRef.current.getDuration());
    });

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, []);

  // 재생 시간 추적
  useEffect(() => {
    if (!wavesurferRef.current || !audioBlob) return;

    const ws = wavesurferRef.current;
    const updateTime = () => setCurrentTime(ws.getCurrentTime());

    ws.on('audioprocess', updateTime);
    return () => {
      ws.un('audioprocess', updateTime);
    };
  }, [audioBlob]);

  const handleStartRecording = async () => {
    if (!isFFmpegLoaded) return alert('FFmpeg 로딩 중입니다.');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStreamRef.current = stream;
    setAudioBlob(null);
    setTimer(0);
    audioChunksRef.current = [];

    wavesurferRef.current.microphone.start();

    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      clearInterval(timerRef.current);
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      wavesurferRef.current.microphone.stop();

      const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      try {
        const ffmpeg = ffmpegRef.current;
        const file = new File([webmBlob], 'input.webm', { type: 'audio/webm' });
        ffmpeg.FS('writeFile', 'input.webm', await fetchFile(file));
        await ffmpeg.run('-i', 'input.webm', 'output.wav');
        const data = ffmpeg.FS('readFile', 'output.wav');
        const wavBlob = new Blob([data.buffer], { type: 'audio/wav' });
        setAudioBlob(wavBlob);

        const audioUrl = URL.createObjectURL(wavBlob);
        wavesurferRef.current.load(audioUrl);

        // 전체 길이 가져오기
        const tempAudio = new Audio(audioUrl);
        tempAudio.onloadedmetadata = () => {
          const dur = tempAudio.duration;
          setDuration(!isNaN(dur) ? formatTime(dur) : '00:00');
          setCurrentTime(0); // 초기화
        };
      } catch (err) {
        console.error('WAV 변환 오류:', err);
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    timerRef.current = setInterval(() => setTimer((prev) => prev + 1), 1000);
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
    setIsPlaying((prev) => !prev);
  };

  const handleCreateVoicePack = async () => {
    if (!voicePackName.trim() || !audioBlob) return alert('이름과 녹음이 필요합니다.');

    const formData = new FormData();
    formData.append('userId', sessionStorage.getItem('userId'));
    formData.append('name', voicePackName);
    formData.append('voiceFile', new File([audioBlob], 'voice.wav', { type: 'audio/wav' }));

    try {
      const res = await fetch(`${process.env.REACT_APP_VOICEPACK_API_URL}/convert`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      alert('보이스팩 생성 완료!');
      navigate('/voicestore');
    } catch (err) {
      console.error('업로드 실패:', err);
    }
  };

  const formatTime = (time) => {
    if (typeof time !== 'number' || isNaN(time)) return '00:00';
    const mins = String(Math.floor(time / 60)).padStart(2, '0');
    const secs = String(Math.floor(time % 60)).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f4ff] px-4 py-8">
      <div className="mb-8 cursor-pointer" onClick={() => navigate('/landing')}>
        <img src={Logo} alt="Logo" />
      </div>

      <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl p-8">
        <label className="block text-gray-700 text-xl font-semibold mb-2">보이스팩 이름</label>
        <input
          value={voicePackName}
          onChange={(e) => setVoicePackName(e.target.value)}
          className="w-full px-4 py-2 border rounded-md mb-6"
          placeholder="보이스팩 이름 입력"
        />

        <h2 className="text-xl font-bold text-gray-900 mb-2">보이스팩 샘플 녹음</h2>
        <p className="text-sm text-gray-500 mb-4">녹음 버튼을 누르고 각 문장을 따라 읽어주세요.</p>

        <div className="bg-[#f5f4ff] rounded-xl p-6">
          <p className="text-lg font-medium text-gray-800 mb-4">
            “안녕하세요. 목소리를 제공합니다. 잘 들리시나요? 감사합니다.”
          </p>

          <div className="flex items-center bg-[#f5f4ff] rounded-xl px-6 py-4 space-x-4">
            {/* 마이크 버튼 */}
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg transition-colors duration-300 ${
                isRecording ? 'bg-[#7C3AED]' : 'bg-gray-300'
              }`}
              disabled={!isFFmpegLoaded}
            >
              <Mic />
            </button>

            {/* 재생 버튼 */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-[#7C3AED] text-white text-xl flex items-center justify-center shadow-md hover:bg-[#6b2ed4] transition disabled:bg-gray-300"
              disabled={!audioBlob}
            >
              {isPlaying ? <Pause /> : <Play />}
            </button>

            {/* 파형 */}
            <div ref={waveformRef} className="flex-1 h-[60px]" />

            {/* 시간 표시: 현재 / 전체 */}
            <span className="text-sm text-[#7C3AED] w-[80px] text-right">
              {audioBlob ? `${formatTime(currentTime)} / ${duration}` : formatTime(timer)}
            </span>
          </div>

          <button
            onClick={handleCreateVoicePack}
            className="mt-6 w-full py-3 bg-[#7C3AED] text-white rounded-md text-sm font-semibold disabled:opacity-50"
            disabled={!voicePackName.trim() || !audioBlob}
          >
            보이스팩 생성
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoiceCreate;
