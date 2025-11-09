import React, { useMemo, useEffect, useState } from 'react';
import { Map, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer, ColumnLayer } from '@deck.gl/layers';
import { Layer } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';


type Color = [number, number, number, number];
export type DataPoint = [longitude: number, latitude: number, count: number];


export interface APIDataPoint {
  topic: string;
  lon: number;
  lat: number;
  text: string;
  author: string;
}


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


const DEFAULT_COLOR_RANGE: Color[] = [
  [255, 255, 178, 25],
  [254, 217, 118, 85],
  [254, 178, 76, 127],
  [253, 141, 60, 170],
  [240, 59, 32, 212],
  [189, 0, 38, 255]
];

export interface SimpleMapProps {

  className?: string;
  style?: React.CSSProperties;


  viewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
  };


  data?: DataPoint[] | APIDataPoint[] | string;
  colorRange?: Color[];
  opacity?: number;
  cellSize?: number;
  aggregation?: 'SUM' | 'MEAN' | 'MIN' | 'MAX';
  colorDomain?: [number, number];


  pickable?: boolean;
  onHover?: (info: PickingInfo) => void;
  onClick?: (info: PickingInfo) => void;
  onViewStateChange?: (params: any) => void;
  onLoad?: () => void;


  refreshKey?: number;
}

const SimpleMap: React.FC<SimpleMapProps> = (props) => {
  const {
    className,
    style,
    viewState = {
      longitude: -95,
      latitude: 40,
      zoom: 4,
      pitch: 0,
      bearing: 0
    },
    data = [],
    colorRange = DEFAULT_COLOR_RANGE,
    opacity = 0.8,
    cellSize = 12,
    aggregation = 'SUM',
    colorDomain = [0, 20],
    pickable = false,
    onHover,
    onClick,
    onViewStateChange,
    onLoad,
    refreshKey = 0
  } = props;


  const [clickedNodeId, setClickedNodeId] = useState<string | null>(null);
  const [clickTime, setClickTime] = useState<number>(0);


  const getDataSource = (inputData: string | DataPoint[] | APIDataPoint[] | undefined): string | DataPoint[] | APIDataPoint[] => {
    if (!inputData || (Array.isArray(inputData) && inputData.length === 0)) {
      console.log("SimpleMap: No data provided, returning empty array");
      return [];
    }

    if (Array.isArray(inputData)) {
      console.log("SimpleMap: Data source provided: Data array with", inputData.length, "items");

      if (inputData.length > 0) {
        console.log("SimpleMap: Sample data point:", inputData[0]);

        const validCount = inputData.filter(item => {
          if (Array.isArray(item)) {
            return typeof item[0] === 'number' && typeof item[1] === 'number';
          } else {
            return typeof item.lat === 'number' && typeof item.lon === 'number';
          }
        }).length;
        console.log(`SimpleMap: ${validCount}/${inputData.length} items have valid coordinates`);
      }
    } else {
      console.log("SimpleMap: Data source provided: URL string");
    }

    return inputData;
  };


  const layers = useMemo(() => {
    const dataSource = getDataSource(data);

    if (Array.isArray(dataSource) && dataSource.length === 0) {
      console.log("SimpleMap: Empty data array, not creating layer");
      return [];
    }


    console.log("SimpleMap: Creating ScatterplotLayer with data source",
                typeof dataSource === 'string' ? dataSource : `Array with ${dataSource.length} items`);
    console.log(`SimpleMap: Layer dependencies changed, recreating ScatterplotLayer with refreshKey: ${refreshKey}`);


    const locationMap: { [key: string]: any[] } = {};
    if (Array.isArray(dataSource)) {
      dataSource.forEach((item: any) => {
        const lon = Array.isArray(item) ? item[0] : item.lon;
        const lat = Array.isArray(item) ? item[1] : item.lat;
        const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;

        if (!locationMap[key]) {
          locationMap[key] = [];
        }
        locationMap[key].push(item);
      });
    }


    const aggregatedData: Array<{position: number[]; count: number; items: any[]; id: string}> = [];
    Object.keys(locationMap).forEach((key: string) => {
      const items = locationMap[key];
      const firstItem = items[0];
      const lon = Array.isArray(firstItem) ? firstItem[0] : firstItem.lon;
      const lat = Array.isArray(firstItem) ? firstItem[1] : firstItem.lat;

      aggregatedData.push({
        position: [lon, lat],
        count: items.length,
        items: items,
        id: key
      });
    });

    return [

      new ColumnLayer<{position: number[]; count: number; items: any[]; id: string}>({
        id: `column-3d-${refreshKey}`,
        data: aggregatedData,
        diskResolution: 12,
        getPosition: (d: any) => d.position,
        getElevation: (d: any) => d.count * 12500,
        getFillColor: (d: any) => {

          const darkness = Math.min(d.count / 20, 1);
          return [
            Math.floor(150 + darkness * 76),
            Math.floor(0),
            Math.floor(74 + darkness * 42),
            Math.floor(180 + darkness * 75)
          ];
        },
        getLineColor: [255, 255, 255, 80],
        radius: 15000,
        elevationScale: 1,
        pickable: true,
        extruded: true,
        wireframe: false,
        opacity: 0.9,
        onHover: (info) => {
          if (info.object && onHover) {
            const hoveredData = {
              ...info,
              object: {
                id: info.object.id,
                points: info.object.items.map((item: any) => ({
                  text: Array.isArray(item) ? '' : (item.text || ''),
                  author: Array.isArray(item) ? '' : (item.author || 'Unknown'),
                  topic: Array.isArray(item) ? '' : (item.topic || 'No topic'),
                  location: Array.isArray(item) ? undefined : (item.location || undefined)
                }))
              }
            };
            onHover(hoveredData);
          }
          return true;
        },
        onClick: (info) => {
          if (info.object && onClick) {
            const clickData = {
              ...info,
              object: {
                id: info.object.id,
                points: info.object.items.map((item: any) => ({
                  text: Array.isArray(item) ? '' : (item.text || ''),
                  author: Array.isArray(item) ? '' : (item.author || 'Unknown'),
                  topic: Array.isArray(item) ? '' : (item.topic || 'No topic'),
                  location: Array.isArray(item) ? undefined : (item.location || undefined)
                }))
              }
            };

            setClickedNodeId(info.object.id);
            setClickTime(Date.now());
            onClick(clickData);
          }
          return true;
        }
      }),

      new ScatterplotLayer<{position: number[]; count: number; items: any[]; id: string}>({
        id: `glow-middle-${refreshKey}`,
        data: aggregatedData,
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => {
          const scaleFactor = Math.pow(d.count, 0.6);
          return Math.min(scaleFactor * 13000, 75000);
        },
        getFillColor: (d: any) => {
          const intensity = Math.min(d.count / 5, 1);
          return [
            Math.floor(180 + intensity * 75),
            Math.floor(0 + intensity * 25),
            Math.floor(116 + intensity * 31),
            Math.floor(110 + intensity * 60)
          ];
        },
        radiusScale: 1,
        radiusMinPixels: 14,
        radiusMaxPixels: 160,
        pickable: true,
        filled: true,
        stroked: false,
        opacity: 0.55,
        antialiasing: false,
        onHover: (info) => {
          if (info.object && onHover) {
            const hoveredData = {
              ...info,
              object: {
                points: info.object.items.map((item: any) => ({
                  text: Array.isArray(item) ? '' : (item.text || ''),
                  author: Array.isArray(item) ? '' : (item.author || 'Unknown'),
                  topic: Array.isArray(item) ? '' : (item.topic || 'No topic'),
                  location: Array.isArray(item) ? undefined : (item.location || undefined)
                }))
              }
            };
            onHover(hoveredData);
          }
          return true;
        }
      }),

      new ScatterplotLayer<{position: number[]; count: number; items: any[]; id: string}>({
        id: `scatterplot-core-${refreshKey}`,
        data: aggregatedData,
        getPosition: (d: any) => d.position,
        getRadius: (d: any) => {
          const scaleFactor = Math.pow(d.count, 0.55);
          return Math.min(scaleFactor * 10000, 60000);
        },
        getFillColor: (d: any) => {
          const intensity = Math.min(d.count / 5, 1);
          return [
            Math.floor(226 + intensity * 29),
            Math.floor(0 + intensity * 30),
            Math.floor(116 + intensity * 31),
            250
          ];
        },
        getLineColor: (d: any) => {

          const intensity = Math.min(d.count / 5, 1);
          return [
            Math.floor(255),
            Math.floor(255 - intensity * 200),
            Math.floor(255 - intensity * 110),
            200
          ];
        },
        getLineWidth: 2,
        lineWidthMinPixels: 1,
        radiusScale: 1,
        radiusMinPixels: 10,
        radiusMaxPixels: 130,
        pickable: true,
        stroked: true,
        filled: true,
        opacity: 0.95,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 120],
        antialiasing: false,
        onHover: (info) => {
          if (info.object && onHover) {
            const hoveredData = {
              ...info,
              object: {
                id: info.object.id,
                points: info.object.items.map((item: any) => ({
                  text: Array.isArray(item) ? '' : (item.text || ''),
                  author: Array.isArray(item) ? '' : (item.author || 'Unknown'),
                  topic: Array.isArray(item) ? '' : (item.topic || 'No topic'),
                  location: Array.isArray(item) ? undefined : (item.location || undefined)
                }))
              }
            };
            onHover(hoveredData);
          }
          return true;
        },
        onClick: (info) => {
          if (onClick) {
            onClick(info);
          }
          return true;
        }
      })
    ];
  }, [data, opacity, cellSize, colorRange, colorDomain, aggregation, pickable, onHover, onClick, refreshKey]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        ...style
      }}
    >
      <Map
        mapLib={maplibregl}
        {...viewState}
        onMove={(evt) => {

          if (onViewStateChange) {
            onViewStateChange({ viewState: evt.viewState });
          }
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        dragRotate={true}
        pitchWithRotate={true}
        touchPitch={true}

        touchZoomRotate={true}
        doubleClickZoom={true}
        keyboard={true}
        onLoad={() => {
          if (onLoad) {
            onLoad();
          }
        }}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
    </div>
  );
};

export default SimpleMap;
