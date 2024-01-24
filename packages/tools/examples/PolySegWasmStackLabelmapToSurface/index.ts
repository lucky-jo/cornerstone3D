import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  volumeLoader,
  CONSTANTS,
  utilities,
  Types,
  imageLoader,
} from '@cornerstonejs/core';
import * as cornerstone from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setTitleAndDescription,
  setCtTransferFunctionForVolumeActor,
  addButtonToToolbar,
  addDropdownToToolbar,
  addToggleButtonToToolbar,
  createInfoSection,
} from '../../../../utils/demo/helpers';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { fillStackSegmentationWithMockData } from '../../../../utils/test/fillStackSegmentationWithMockData';

// This is for debugging purposes
console.warn(
  'Click on index.ts to open source code for this example --------->'
);

const {
  SegmentationDisplayTool,
  ToolGroupManager,
  Enums: csToolsEnums,
  segmentation,
  BrushTool,
  PanTool,
  ZoomTool,
  StackScrollMouseWheelTool,
  TrackballRotateTool,
} = cornerstoneTools;

setTitleAndDescription(
  'Stack Labelmap to Surface',
  'This demonstration showcases the usage of PolySEG WASM module to convert a labelmap to a surface representation.'
);

const { MouseBindings } = csToolsEnums;
const { ViewportType } = Enums;

const segmentationId = 'MY_SEGMENTATION_ID';

// ======== Set up page ======== //

const size = '500px';
const content = document.getElementById('content');
const viewportGrid = document.createElement('div');

viewportGrid.style.display = 'flex';
viewportGrid.style.display = 'flex';
viewportGrid.style.flexDirection = 'row';

const element1 = document.createElement('div');
const element2 = document.createElement('div');
element1.style.width = size;
element1.style.height = size;
element2.style.width = size;
element2.style.height = size;

// Disable right click context menu so we can have right click tools
element1.oncontextmenu = (e) => e.preventDefault();
element2.oncontextmenu = (e) => e.preventDefault();

viewportGrid.appendChild(element1);
viewportGrid.appendChild(element2);

content.appendChild(viewportGrid);

createInfoSection(content, { ordered: true })
  .addInstruction('Use the Brush Tool for segmentation in Stack viewports')
  .addInstruction(
    'Toggle between different segmentation tools like Circle Brush and Eraser'
  )
  .addInstruction('Convert the labelmap to a 3D surface representation')
  .addInstruction('Manipulate the 3D view using the Trackball Rotate Tool')
  .addInstruction('Toggle the visibility of the 3D anatomy model');

// ============================= //
const toolGroupId = 'ToolGroup_MPR';
const toolGroupId2 = 'ToolGroup_3D';
let toolGroup1, toolGroup2;
let renderingEngine;
// Create the viewports
const viewportId1 = 'CT_STACK';
const viewportId2 = 'CT_3D';

const segmentIndexes = [1, 2, 3, 4, 5];

addButtonToToolbar({
  title: 'Convert labelmap to surface',
  onClick: async () => {
    // add the 3d representation to the 3d toolgroup
    await segmentation.addSegmentationRepresentations(toolGroupId2, [
      {
        segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Surface,
        options: {
          polySeg: true,
        },
      },
    ]);
  },
});

addDropdownToToolbar({
  labelText: 'Segment Index',
  options: { values: segmentIndexes, defaultValue: segmentIndexes[0] },
  onSelectedValueChange: (nameAsStringOrNumber) => {
    segmentation.segmentIndex.setActiveSegmentIndex(
      segmentationId,
      nameAsStringOrNumber as number
    );
  },
});

addToggleButtonToToolbar({
  title: 'Toggle Brush and Eraser',
  defaultToggle: true,
  onClick: async (toggle) => {
    if (toggle) {
      toolGroup1.setToolDisabled('EraserBrush', {});
      toolGroup1.setToolActive('CircularBrush', {
        bindings: [
          {
            mouseButton: MouseBindings.Primary, // Middle Click
          },
        ],
      });
    } else {
      toolGroup1.setToolDisabled('CircularBrush', {});
      toolGroup1.setToolActive('EraserBrush', {
        bindings: [
          {
            mouseButton: MouseBindings.Primary, // Middle Click
          },
        ],
      });
    }
  },
});

/**
 * Runs the demo
 */
async function run() {
  // Init Cornerstone and related libraries
  await initDemo();

  // Add tools to Cornerstone3D
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(StackScrollMouseWheelTool);
  cornerstoneTools.addTool(SegmentationDisplayTool);
  cornerstoneTools.addTool(BrushTool);
  cornerstoneTools.addTool(TrackballRotateTool);

  // Define tool groups to add the segmentation display tool to
  toolGroup1 = ToolGroupManager.createToolGroup(toolGroupId);
  toolGroup2 = ToolGroupManager.createToolGroup(toolGroupId2);

  // Manipulation Tools
  toolGroup1.addTool(PanTool.toolName);
  toolGroup1.addTool(ZoomTool.toolName);
  toolGroup1.addTool(StackScrollMouseWheelTool.toolName);

  // Segmentation Tools
  toolGroup1.addTool(SegmentationDisplayTool.toolName);
  toolGroup1.addToolInstance('CircularBrush', BrushTool.toolName, {
    activeStrategy: 'FILL_INSIDE_CIRCLE',
  });
  toolGroup1.addToolInstance('EraserBrush', BrushTool.toolName, {
    activeStrategy: 'ERASE_INSIDE_CIRCLE',
  });

  toolGroup2.addTool(PanTool.toolName);
  toolGroup2.addTool(TrackballRotateTool.toolName);
  toolGroup2.addTool(SegmentationDisplayTool.toolName);
  toolGroup2.addTool(ZoomTool.toolName);

  // activations
  toolGroup1.setToolEnabled(SegmentationDisplayTool.toolName);
  toolGroup2.setToolEnabled(SegmentationDisplayTool.toolName);

  toolGroup1.setToolActive('CircularBrush', {
    bindings: [
      {
        mouseButton: MouseBindings.Primary, // Middle Click
      },
    ],
  });
  toolGroup1.setToolActive(ZoomTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Secondary, // Right Click
      },
    ],
  });
  toolGroup1.setToolActive(PanTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Auxiliary,
      },
    ],
  });
  toolGroup2.setToolActive(PanTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Auxiliary,
      },
    ],
  });
  // As the Stack Scroll mouse wheel is a tool using the `mouseWheelCallback`
  // hook instead of mouse buttons, it does not need to assign any mouse button.
  toolGroup1.setToolActive(StackScrollMouseWheelTool.toolName);
  toolGroup2.setToolActive(TrackballRotateTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary, // Left Click
      },
    ],
  });
  toolGroup2.setToolActive(ZoomTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Secondary, // Right Click
      },
    ],
  });

  // Get Cornerstone imageIds for the source data and fetch metadata into RAM
  let stackImageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID: '1.2.840.113663.1500.1.248223208.1.1.20110323.105903.687',
    SeriesInstanceUID:
      '1.2.840.113663.1500.1.248223208.2.1.20110323.105903.687',
    wadoRsRoot: 'https://d33do7qe4w26qo.cloudfront.net/dicomweb',
  });

  // since this series has some other sop that is not really relevant
  stackImageIds = stackImageIds.slice(0, 2);

  // Instantiate a rendering engine
  const renderingEngineId = 'myRenderingEngine';
  renderingEngine = new RenderingEngine(renderingEngineId);

  const viewportInputArray = [
    {
      viewportId: viewportId1,
      type: ViewportType.STACK,
      element: element1,
    },
    {
      viewportId: viewportId2,
      type: ViewportType.VOLUME_3D,
      element: element2,
      defaultOptions: {
        background: CONSTANTS.BACKGROUND_COLORS.slicer3D,
      },
    },
  ];

  renderingEngine.setViewports(viewportInputArray);

  toolGroup1.addViewport(viewportId1, renderingEngineId);
  toolGroup2.addViewport(viewportId2, renderingEngineId);

  const viewport1 = renderingEngine.getViewport(viewportId1);
  await viewport1.setStack(stackImageIds, 0);

  cornerstoneTools.utilities.stackContextPrefetch.enable(element1);

  const { imageIds: segmentationImageIds } =
    await imageLoader.createAndCacheDerivedSegmentationImages(stackImageIds);

  fillStackSegmentationWithMockData({
    imageIds: stackImageIds,
    segmentationImageIds,
    cornerstone,
  });

  segmentation.addSegmentations([
    {
      segmentationId,
      representation: {
        type: csToolsEnums.SegmentationRepresentations.Labelmap,
        data: {
          imageIdReferenceMap:
            cornerstoneTools.utilities.segmentation.createImageIdReferenceMap(
              stackImageIds,
              segmentationImageIds
            ),
        },
      },
    },
  ]);

  // Add the segmentation representation to the toolgroup
  await segmentation.addSegmentationRepresentations(toolGroupId, [
    {
      segmentationId,
      type: csToolsEnums.SegmentationRepresentations.Labelmap,
    },
  ]);

  // Render the image
  renderingEngine.renderViewports([viewportId1, viewportId2]);
}

run();
