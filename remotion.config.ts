import {Config} from '@remotion/cli/config';

// GPU 없는 GitHub Actions 러너에서도 WebGL(MapLibre)이 돌도록 SwiftShader 사용
Config.setChromiumOpenGlRenderer('swangle');
Config.setVideoImageFormat('jpeg');
