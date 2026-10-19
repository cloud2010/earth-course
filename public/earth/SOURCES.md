# 地球材质素材来源

这些文件用于课堂视觉演示，均随仓库提供，不会在运行时请求远程纹理。

| 文件 | 来源 | 本项目用途 |
| --- | --- | --- |
| `blue-marble-june.jpg` | NASA Earth Observatory [Blue Marble: Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/)，2004 年 6 月、5400 × 2700 全球合成影像 | 地表颜色与卫星影像细节 |
| `earth-topology.png` | [three-globe 官方示例的地形纹理](https://github.com/vasturiano/three-globe/blob/master/example/img/earth-topology.png) | 材质凹凸细节，不作为可测量的高程数据 |
| `earth-water.png` | [three-globe 官方示例的海陆遮罩](https://github.com/vasturiano/three-globe/blob/master/example/img/earth-water.png) | 海水区域的蓝色提亮和反光范围 |
| `earth-clouds.png` | [three-globe 官方云层示例纹理](https://github.com/vasturiano/three-globe/blob/master/example/clouds/clouds.png)；示例注明来自 [turban/webgl-earth](https://github.com/turban/webgl-earth) | 半透明云层与轻微漂移 |

辅助纹理取自本项目安装的 `three-globe` npm 包所附示例。地球材质采用 Three.js 物理材质，海面反光依据海陆遮罩控制；地形和云层为视觉辅助，均不表示实时数据。卫星影像的海水颜色经过适度提亮，陆地区域保留原影像纹理。

参考实现：[自定义材质示例](https://github.com/vasturiano/three-globe/blob/master/example/custom-material/index.html)、[云层示例](https://github.com/vasturiano/three-globe/blob/master/example/clouds/index.html)。素材使用和署名要求以原始来源说明为准。
