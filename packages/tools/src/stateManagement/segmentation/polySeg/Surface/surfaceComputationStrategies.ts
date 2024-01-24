import { Types } from '@cornerstonejs/core';
import { ContourSegmentationData } from '../../../../types';
import { getUniqueSegmentIndices } from '../../../../utilities/segmentation';
import { getSegmentation } from '../../segmentationState';
import { convertContourToSurface } from './convertContourToSurface';
import { createAndCacheSurfacesFromRaw } from './createAndCacheSurfacesFromRaw';
import {
  LabelmapSegmentationData,
  LabelmapSegmentationDataStack,
  LabelmapSegmentationDataVolume,
} from '../../../../types/LabelmapTypes';
import { isVolumeSegmentation } from '../../../../tools/segmentation/strategies/utils/stackVolumeCheck';
import {
  convertStackLabelmapToSurface,
  convertVolumeLabelmapToSurface,
} from './convertLabelmapToSurface';

export type RawSurfacesData = {
  segmentIndex: number;
  data: Types.SurfaceData;
}[];

/**
 * Computes surface data for a given segmentation.
 * @param segmentationId - The ID of the segmentation.
 * @param options - Additional options for surface computation.
 * @returns A promise that resolves to the computed surface data.
 * @throws An error if there is no surface data available for the segmentation.
 */
export async function computeSurfaceData(
  segmentationId: string,
  options: {
    segmentIndices?: number[];
    segmentationRepresentationUID?: string;
  }
) {
  const segmentIndices = options.segmentIndices?.length
    ? options.segmentIndices
    : getUniqueSegmentIndices(segmentationId);

  let rawSurfacesData: RawSurfacesData;
  const segmentation = getSegmentation(segmentationId);
  const representationData = segmentation.representationData;

  try {
    if (representationData.CONTOUR) {
      rawSurfacesData = await computeSurfaceFromContourSegmentation(
        segmentationId,
        {
          segmentIndices,
          ...options,
        }
      );
    } else if (
      (representationData.LABELMAP as LabelmapSegmentationDataVolume)?.volumeId
    ) {
      // convert volume labelmap to surface
      rawSurfacesData = await computeSurfaceFromLabelmapSegmentation(
        segmentation.segmentationId,
        {
          segmentIndices,
          ...options,
        }
      );
    }
  } catch (error) {
    console.error(error);
    throw error;
  }

  if (!rawSurfacesData) {
    throw new Error(
      'Not enough data to convert to surface, currently only support converting volume labelmap to surface if available'
    );
  }

  const surfacesData = await createAndCacheSurfacesFromRaw(
    segmentationId,
    rawSurfacesData,
    options
  );

  return surfacesData;
}

async function computeSurfaceFromLabelmapSegmentation(
  segmentationId,
  options: {
    segmentIndices?: number[];
    segmentationRepresentationUID?: string;
  } = {}
): Promise<RawSurfacesData> {
  // Todo: validate valid labelmap representation
  const segmentation = getSegmentation(segmentationId);

  if (!segmentation?.representationData?.LABELMAP) {
    throw new Error('No labelmap data found for segmentation');
  }

  const isVolume = isVolumeSegmentation(
    segmentation.representationData.LABELMAP
  );

  const labelmapRepresentationData = segmentation.representationData.LABELMAP;

  const segmentIndices =
    options.segmentIndices || getUniqueSegmentIndices(segmentationId);
  const promises = segmentIndices.map(async (index) => {
    const surface = isVolume
      ? await convertVolumeLabelmapToSurface(
          labelmapRepresentationData as LabelmapSegmentationDataVolume,
          index
        )
      : await convertStackLabelmapToSurface(
          labelmapRepresentationData as LabelmapSegmentationDataStack,
          index
        );

    return { segmentIndex: index, data: surface };
  });

  const surfaces = await Promise.all(promises);

  return surfaces;
}

/**
 * Computes the surface from contour segmentation.
 * @param segmentationId - The ID of the segmentation.
 * @param options - The options for surface computation.
 * @returns A promise that resolves to the raw surfaces data.
 */
async function computeSurfaceFromContourSegmentation(
  segmentationId: string,
  options: {
    segmentationRepresentationUID?: string;
    segmentIndices?: number[];
  } = {}
): Promise<RawSurfacesData> {
  const segmentation = getSegmentation(segmentationId);

  const contourRepresentationData = segmentation.representationData.CONTOUR;

  const segmentIndices =
    options.segmentIndices || getUniqueSegmentIndices(segmentationId);

  const promises = segmentIndices.map(async (index) => {
    const surface = await convertContourToSurface(
      contourRepresentationData as ContourSegmentationData,
      index
    );

    return { segmentIndex: index, data: surface };
  });

  const surfaces = await Promise.all(promises);

  return surfaces;
}

export {
  computeSurfaceFromContourSegmentation,
  computeSurfaceFromLabelmapSegmentation,
};
