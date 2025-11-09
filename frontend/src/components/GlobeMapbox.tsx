

import React, { useRef, useMemo, useState, useEffect } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map, useControl } from "react-map-gl/maplibre";
import type { ViewState } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl from "maplibre-gl";
import { Layer, COORDINATE_SYSTEM, FlyToInterpolator } from "@deck.gl/core";
import type { PickingInfo } from "@deck.gl/core";
import { ScreenGridLayer } from "@deck.gl/aggregation-layers";


type Color = [number, number, number, number];
export type DataPoint = [longitude: number, latitude: number, count: number];


export interface APIDataPoint {
  topic: string;
  lon: number;
  lat: number;
  text: string;
  author: string;
}


interface CustomViewState extends Partial<ViewState> {
  transitionDuration?: number;
  transitionInterpolator?: string | FlyToInterpolator;
}


const DEFAULT_COLOR_RANGE: Color[] = [
  [255, 255, 178, 25],
  [254, 217, 118, 85],
  [254, 178, 76, 127],
  [253, 141, 60, 170],
  [240, 59, 32, 212],
  [189, 0, 38, 255]
];


interface DeckGLOverlayProps {
  layers: Layer[];
  interleaved?: boolean;
  onHover?: (info: PickingInfo) => void;
}


function DeckGLOverlay(props: DeckGLOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export interface GlobeMapboxProps {

  className?: string;
  style?: React.CSSProperties;
  initialViewState?: CustomViewState;
  brightness?: number;
  globeOutlineColor?: string;
  globeOutlineWidth?: number;


  data?: DataPoint[] | APIDataPoint[] | string;
  colorRange?: Color[];
  opacity?: number;
  cellSize?: number;
  aggregation?: 'SUM' | 'MEAN' | 'MIN' | 'MAX';
  colorDomain?: [number, number];


  pickable?: boolean;
  onHover?: (info: PickingInfo) => void;
  onClick?: (info: PickingInfo) => void;


  autoRotate?: boolean;
  rotationSpeed?: number;
}

const GlobeMapbox: React.FC<GlobeMapboxProps> = (props) => {
  const {

    brightness = 1.0,
    globeOutlineColor = "#FFFFFF",
    globeOutlineWidth = 0,
    className,
    style,
    initialViewState,


    data = [],
    colorRange = DEFAULT_COLOR_RANGE,
    opacity = 0.8,
    cellSize = 12,
    aggregation = 'SUM',
    colorDomain = [0, 20],


    pickable = false,
    onHover,
  } = props;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);


  const [viewState, setViewState] = useState<any>(() => ({
    longitude: initialViewState?.longitude ?? 0,
    latitude: initialViewState?.latitude ?? 20,
    zoom: initialViewState?.zoom ?? 2,
    pitch: initialViewState?.pitch ?? 0,
    bearing: initialViewState?.bearing ?? 0,
    padding: initialViewState?.padding ?? {top: 0, bottom: 0, left: 0, right: 0},
  }));


  useEffect(() => {
    if (initialViewState) {
      const newViewState: Partial<ViewState> & { transitionDuration?: number; transitionInterpolator?: FlyToInterpolator } = {
        longitude: initialViewState.longitude ?? 0,
        latitude: initialViewState.latitude ?? 20,
        zoom: initialViewState.zoom ?? 2,
        pitch: initialViewState.pitch ?? 0,
        bearing: initialViewState.bearing ?? 0,
        padding: initialViewState.padding ?? {top: 0, bottom: 0, left: 0, right: 0},
      };


      if (initialViewState.transitionDuration && initialViewState.transitionInterpolator === 'FlyToInterpolator') {
        newViewState.transitionDuration = initialViewState.transitionDuration;
        newViewState.transitionInterpolator = new FlyToInterpolator();
      }

      setViewState(newViewState);
    }
  }, [initialViewState]);


  const getDataSource = (inputData: string | DataPoint[] | APIDataPoint[] | undefined): string | DataPoint[] | APIDataPoint[] => {
    if (!inputData || (Array.isArray(inputData) && inputData.length === 0)) {
      console.log("GlobeMapbox: No data provided, returning empty array");
      return [];
    }
    console.log("GlobeMapbox: Data source provided:", typeof inputData === 'string' ? 'URL string' : 'Data array');
    return inputData;
  };


  const layers = useMemo(() => {
    const dataSource = getDataSource(data);


    if (Array.isArray(dataSource) && dataSource.length === 0) {
      console.log("GlobeMapbox: Empty data array, not creating layer");
      return [];
    }

    console.log("GlobeMapbox: Creating ScreenGridLayer with data source",
                typeof dataSource === 'string' ? dataSource : `Array with ${dataSource.length} items`);

    return [
      new ScreenGridLayer({
        id: 'grid',
        data: dataSource,
        opacity,
        getPosition: d => {

          if (Array.isArray(d)) {

            return [d[0], d[1]];
          } else if (d.lon !== undefined && d.lat !== undefined) {

            return [d.lon, d.lat];
          }
          return [0, 0];
        },
        getWeight: d => {


          if (Array.isArray(d)) {
            return d[2] || Math.floor(Math.random() * 3) + 1;
          } else if (d.author) {

            const lastChar = d.author.charCodeAt(d.author.length - 1) || 1;
            return (lastChar % 3) + 1;
          }
          return Math.floor(Math.random() * 3) + 1;
        },
        cellSizePixels: cellSize,
        colorRange,
        coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
        wrapLongitude: true,
        gpuAggregation: true,
        colorDomain,
        aggregation,
        pickable,

        onHover: (info) => {

          if (onHover) {
            onHover(info);
          }

          return false;
        },
      })
    ];
  }, [data, opacity, cellSize, colorRange, colorDomain, aggregation, pickable, onHover]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        ...style
      }}
      className={className}
      ref={mapContainerRef}
    >
      {}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          filter: `brightness(${brightness})`
        }}
      >
        <Map
          reuseMaps
          projection="globe"
          mapLib={maplibregl}
          {...viewState}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
          renderWorldCopies={false}
          onMove={(evt) => {

            setViewState(evt.viewState);
          }}
          onLoad={(evt: { target: maplibregl.Map }) => {
            mapRef.current = evt.target;
          }}
        >
          <DeckGLOverlay layers={layers} interleaved />
        </Map>
      </div>

      {}
      {globeOutlineWidth > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "calc(100% - 40px)",
            height: "calc(100% - 40px)",
            borderRadius: "50%",
            border: `${globeOutlineWidth}px solid ${globeOutlineColor}`,
            pointerEvents: "none",
            zIndex: 10,
            boxSizing: "border-box"
          }}
        />
      )}
    </div>
  );
};

export default GlobeMapbox;
