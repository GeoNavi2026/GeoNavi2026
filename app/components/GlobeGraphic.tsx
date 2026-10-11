/* eslint-disable @next/next/no-img-element -- static SVG artwork exported from Figma */

// The "Globe graphic" behind the upload card. The Figma frame is 1440×900;
// each layer keeps its Figma box as percentages of that frame, and the frame
// is scaled to cover the viewport.
function Layer({ box, src }: { box: string; src: string }) {
  return (
    <div className={`absolute ${box}`}>
      <img src={src} alt="" className="block size-full max-w-none" />
    </div>
  );
}

export default function GlobeGraphic() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 aspect-[1440/900] w-[max(100vw,160dvh)] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
        {/* Sphere: 1120px circle at (160, 0); the SVG adds 140px on each side for its glow. */}
        <Layer box="top-[-15.5556%] left-[1.3889%] h-[155.5556%] w-[97.2222%]" src="/figma/globe-sphere.svg" />
        <div className="absolute inset-0 opacity-28">
          <Layer box="top-0 right-[11.12%] bottom-[-24.34%] left-[11.13%]" src="/figma/globe-graticule.svg" />
        </div>
        <div className="absolute inset-0 opacity-85">
          <div className="absolute top-[13.29%] right-[14.08%] bottom-[-9.52%] left-[24.19%]">
            <Layer box="inset-y-[-0.13%] inset-x-[-0.12%]" src="/figma/globe-arcs.svg" />
          </div>
        </div>
        <div className="absolute top-[12.68%] right-[13.69%] bottom-[-10.13%] left-[23.81%]">
          <Layer box="inset-[-0.11%]" src="/figma/globe-cities.svg" />
        </div>
      </div>
    </div>
  );
}
