import {Config} from '@remotion/cli/config';

// 지도는 Canvas 2D(CPU)로 그리므로 WebGL이 필요 없음
Config.setChromiumOpenGlRenderer('swiftshader');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(90);
