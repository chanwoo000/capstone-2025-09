// src/plugins/microphone.js (ESM 버전)
export default function MicrophonePlugin(options = {}) {
  return {
    name: 'microphone',
    deferInit: false,
    staticProps: {},
    instance: {
      stream: null,
      start() {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          this.stream = stream;
          this.wavesurfer.loadDecodedBuffer(stream);
        });
      },
      stop() {
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }
      },
    },
  };
}
