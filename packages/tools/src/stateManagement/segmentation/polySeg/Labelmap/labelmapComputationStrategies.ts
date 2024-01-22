import { Types, VolumeViewport, volumeLoader } from '@cornerstonejs/core';
import { getUniqueSegmentIndices } from '../../../../utilities/segmentation';
import { getSegmentation } from '../../segmentationState';
import {
  LabelmapSegmentationDataStack,
  LabelmapSegmentationDataVolume,
} from '../../../../types/LabelmapTypes';
import { convertContourToVolumeLabelmap } from './convertContourToLabelmap';

export type RawLabelmapData =
  | LabelmapSegmentationDataVolume
  | LabelmapSegmentationDataStack;

export async function computeLabelmapData(
  segmentationId: string,
  options: {
    segmentIndices?: number[];
    segmentationRepresentationUID?: string;
  }
) {
  const segmentIndices = options.segmentIndices?.length
    ? options.segmentIndices
    : getUniqueSegmentIndices(segmentationId);

  let rawLabelmapData: RawLabelmapData;
  const segmentation = getSegmentation(segmentationId);
  const representationData = segmentation.representationData;

  try {
    if (representationData.CONTOUR) {
      rawLabelmapData = await computeLabelmapFromContourSegmentation(
        segmentationId,
        {
          segmentIndices,
          ...options,
        }
      );
    } else if (representationData.SURFACE) {
      // convert volume labelmap to surface
      // rawLabelmapData = await computeSurfaceFromLabelmapSegmentation(
      //   segmentation.segmentationId,
      //   {
      //     segmentIndices,
      //     ...options,
      //   }
      // );
    }
  } catch (error) {
    console.error(error);
    throw error;
  }

  if (!rawLabelmapData) {
    throw new Error(
      'Not enough data to convert to surface, currently only support converting volume labelmap to surface if available'
    );
  }

  return rawLabelmapData;
}

async function computeLabelmapFromContourSegmentation(
  segmentationId,
  options: {
    segmentIndices?: number[];
    segmentationRepresentationUID?: string;
    viewport?: Types.IVolumeViewport | Types.IStackViewport;
  } = {}
): Promise<LabelmapSegmentationDataVolume | LabelmapSegmentationDataStack> {
  const isVolume = options.viewport instanceof VolumeViewport ?? true;

  if (isVolume && !options.viewport) {
    // Todo: we don't have support for volume viewport without providing the
    // viewport, since we need to get the referenced volumeId from the viewport
    // but we can alternatively provide the volumeId directly, or even better
    // the target metadata for the volume (spacing, origin, dimensions, etc.)
    // and then we can create the volume from that
    throw new Error(
      'Cannot compute labelmap from contour segmentation without providing the viewport'
    );
  }

  const segmentIndices = options.segmentIndices?.length
    ? options.segmentIndices
    : getUniqueSegmentIndices(segmentationId);

  const segmentation = getSegmentation(segmentationId);
  const representationData = segmentation.representationData.CONTOUR;

  let result;
  if (isVolume) {
    const defaultActor = options.viewport.getDefaultActor();
    const { uid: volumeId } = defaultActor;
    const segmentationVolume =
      await volumeLoader.createAndCacheDerivedSegmentationVolume(volumeId);

    result = await convertContourToVolumeLabelmap(
      representationData,
      segmentationVolume,
      {
        segmentIndices,
        segmentationRepresentationUID: options.segmentationRepresentationUID,
      }
    );
  } else {
    const cachedImages = new Map();
    // result = convertContourToStackLabelmap(representationData, cachedImages, {
    //   segmentIndices,
    //   segmentationRepresentationUID: options.segmentationRepresentationUID,
    // });
  }

  return result;
}
export { computeLabelmapFromContourSegmentation };
