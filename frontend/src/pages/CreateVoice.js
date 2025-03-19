import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg'; // ✅ FFmpeg 라이브러리 추가

function CreateVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [voicePackName, setVoicePackName] = useState('');
  const [timer, setTimer] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const navigate = useNavigate();
  const ffmpeg = createFFmpeg({ log: true }); // ✅ FFmpeg 인스턴스 생성

  useEffect(() => {
    if (audioBlob) {
      console.log("✅ 변환된 WAV 오디오 타입:", audioBlob.type);
      console.log("✅ 변환된 WAV 오디오 크기:", audioBlob.size, "bytes");
    }
  }, [audioBlob]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      console.log("🎤 MediaRecorder 지원 코덱:", mediaRecorderRef.current.mimeType);

      audioChunksRef.current = [];
      setTimer(0);

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        console.log("🎵 녹음 완료! 변환 전 파일 타입:", webmBlob.type);
        console.log("🎵 변환 전 파일 크기:", webmBlob.size, "bytes");

        // ✅ WebM → WAV 변환
        try {
          if (!ffmpeg.isLoaded()) {
            await ffmpeg.load(); // FFmpeg 로드
          }
          const webmFile = new File([webmBlob], 'audio.webm', { type: 'audio/webm' });

          ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmFile));
          await ffmpeg.run('-i', 'input.webm', 'output.wav');
          const wavData = ffmpeg.FS('readFile', 'output.wav');

          const wavBlob = new Blob([wavData.buffer], { type: 'audio/wav' });
          setAudioBlob(wavBlob);
          console.log("✅ WAV 변환 완료!");
        } catch (error) {
          console.error("❌ WAV 변환 실패:", error);
          alert("녹음 파일을 WAV로 변환하는 중 오류가 발생했습니다.");
        }

        clearInterval(timerRef.current);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('❌ 오디오 녹음 오류:', error);
      alert('오디오 녹음 중 오류가 발생했습니다.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCreateVoicePack = async () => {
    if (!voicePackName.trim() || !audioBlob) {
      alert('보이스팩 이름과 녹음을 완료해야 합니다.');
      return;
    }

    const apiUrl = process.env.REACT_APP_VOICEPACK_API_URL;
    const endpoint = `${apiUrl}/convert`;

    try {
      // ✅ 변환된 WAV 파일을 서버로 전송
      const audioFile = new File([audioBlob], 'voice.wav', { type: 'audio/wav' });

      console.log("📤 서버로 보낼 파일 타입:", audioFile.type);
      console.log("📤 서버로 보낼 파일 크기:", audioFile.size, "bytes");

      const formData = new FormData();
      formData.append('userId', "27");
      formData.append('name', voicePackName);
      formData.append('voiceFile', audioFile);

      for (let pair of formData.entries()) {
        console.log("📦 FormData:", pair[0], pair[1]);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('서버 응답 실패');
      }

      const data = await response.json();
      alert(`보이스팩 생성 성공: ${JSON.stringify(data)}`);
      navigate('/voicemarket');
    } catch (error) {
      console.error('❌ 보이스팩 생성 오류:', error);
      alert('보이스팩 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      <h1 className="text-3xl font-bold mb-8">보이스팩 생성</h1>

      <div className="w-full max-w-md">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="voicepackName">
          보이스팩 이름 <span className="text-red-500">*</span>
        </label>
        <input
          id="voicepackName"
          type="text"
          placeholder="보이스팩 이름 입력"
          value={voicePackName}
          onChange={(e) => setVoicePackName(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>

      <div className="w-full max-w-md mt-6">
        <h2 className="text-lg font-semibold mb-2">
          보이스팩 샘플 녹음 <span className="text-red-500">*</span>
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          녹음 버튼을 누르고 문장을 따라 읽어주세요.
        </p>

        <div className="mb-4">
          <p className="mb-2">
            안녕하세요. 목소리를 제공합니다. 잘 들리시나요? 감사합니다.
          </p>
          <div className="flex items-center">
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`bg-gray-200 p-2 rounded-full mr-2 ${isRecording ? 'bg-red-500' : ''}`}
            >
              <span role="img" aria-label="microphone">🎤</span>
            </button>
            {audioBlob && <audio src={URL.createObjectURL(audioBlob)} controls className="mr-2" />}
            {isRecording && <span className="text-sm">{timer}s</span>}
          </div>
        </div>
      </div>

      <button
        onClick={handleCreateVoicePack}
        className="bg-purple-500 text-white font-bold py-2 px-4 rounded mt-6"
      >
        생성
      </button>
    </div>
  );
}

export default CreateVoice;
