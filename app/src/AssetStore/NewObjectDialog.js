// @flow
import { t, Trans } from '@lingui/macro';
import { I18n } from '@lingui/react';
import * as React from 'react';
import Dialog from '../UI/Dialog';
import FlatButton from '../UI/FlatButton';
import HelpButton from '../UI/HelpButton';
import { Tabs } from '../UI/Tabs';
import { AssetStore, type AssetStoreInterface } from '.';
import { type ResourceManagementProps } from '../ResourcesList/ResourceSource';
import { sendAssetAddedToProject } from '../Utils/Analytics/EventSender';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import RaisedButton from '../UI/RaisedButton';
import { AssetStoreContext } from './AssetStoreContext';
import AssetPackInstallDialog from './AssetPackInstallDialog';
import { type EnumeratedObjectMetadata } from '../ObjectsList/EnumerateObjects';
import {
  installRequiredExtensions,
  installPublicAsset,
  checkRequiredExtensionsUpdate,
  checkRequiredExtensionsUpdateForAssets,
} from './InstallAsset';
import {
  type Asset,
  type AssetShortHeader,
  getPublicAsset,
  isPrivateAsset,
} from '../Utils/GDevelopServices/Asset';
import { type ExtensionShortHeader } from '../Utils/GDevelopServices/Extension';
import EventsFunctionsExtensionsContext from '../EventsFunctionsExtensionsLoader/EventsFunctionsExtensionsContext';
import Window from '../Utils/Window';
import PrivateAssetsAuthorizationContext from './PrivateAssets/PrivateAssetsAuthorizationContext';
import useAlertDialog from '../UI/Alert/useAlertDialog';
import { useResponsiveWindowSize } from '../UI/Responsive/ResponsiveWindowMeasurer';
import { enumerateAssetStoreIds } from './EnumerateAssetStoreIds';
import PromisePool from '@supercharge/promise-pool';
import NewObjectFromScratch from './NewObjectFromScratch';
import { getAssetShortHeadersToDisplay } from './AssetsList';
import ErrorBoundary from '../UI/ErrorBoundary';
import NFTCard from '../MainFrame/EditorContainers/HomePage/BuildSection/NFTCard.jsx';
import { NFTContext } from '../context/NFTContext';
import { useState, useEffect } from 'react';
import NFTDetailPage from './NFTDetailPage.jsx';

const isDev = Window.isDev();

export const useExtensionUpdateAlertDialog = () => {
  const { showConfirmation } = useAlertDialog();
  return async (
    outOfDateExtensionShortHeaders: Array<ExtensionShortHeader>
  ): Promise<boolean> => {
    return await showConfirmation({
      title: t`Extension update`,
      message: t`Before installing this asset, it's strongly recommended to update these extensions${'\n\n - ' +
        outOfDateExtensionShortHeaders
          .map(extension => extension.fullName)
          .join('\n\n - ') +
        '\n\n'}Do you want to update it now ?`,
      confirmButtonLabel: t`Update the extension`,
      dismissButtonLabel: t`Skip the update`,
    });
  };
};

export const useFetchAssets = () => {
  const { environment } = React.useContext(AssetStoreContext);

  const { fetchPrivateAsset } = React.useContext(
    PrivateAssetsAuthorizationContext
  );

  return async (
    assetShortHeaders: Array<AssetShortHeader>
  ): Promise<Array<Asset>> => {
    const fetchedAssets = await PromisePool.withConcurrency(6)
      .for(assetShortHeaders)
      .process<Asset>(async assetShortHeader => {
        const asset = isPrivateAsset(assetShortHeader)
          ? await fetchPrivateAsset(assetShortHeader, {
              environment,
            })
          : await getPublicAsset(assetShortHeader, { environment });
        if (!asset) {
          throw new Error(
            'Unable to install the asset because it could not be fetched.'
          );
        }

        return asset;
      });
    if (fetchedAssets.errors.length) {
      throw new Error(
        'Error(s) while installing assets. The first error is: ' +
          fetchedAssets.errors[0].message
      );
    }
    const assets = fetchedAssets.results;
    return assets;
  };
};

// export const useFetchNFTAssets = () => {
//   const { environment } = React.useContext(AssetStoreContext);
//   const { fetchMyNFTs} = React.useContext(NFTContext);

//   return (
//     async fetchMyNFTs().then((nfts) => {
//     await PromisePool.withConcurrency(6)
//       .for(nfts)
//       .process(async nft => {
//         const asset = isPrivateAsset(nft)
//           ? await fetchPrivateAsset(nft, {
//             environment,
//           })
//           : await getPublicAsset(nft, { environment });
//         const json = await nft.image;
//         json.image
//         return asset;
//       });
//   }).catch((e)=>{
//     throw new Error(e.errors[0].message)
//     `there is an error with fetching my nft , ${e}`
//   })
// );
// };

type Props = {|
  project: gdProject,
  layout: ?gdLayout,
  objectsContainer: gdObjectsContainer,
  resourceManagementProps: ResourceManagementProps,
  onClose: () => void,
  onCreateNewObject: (type: string) => void,
  onObjectsAddedFromAssets: (Array<gdObject>) => void,
  canInstallPrivateAsset: () => boolean,
|};

function NewObjectDialog({
  project,
  layout,
  objectsContainer,
  resourceManagementProps,
  onClose,
  onCreateNewObject,
  onObjectsAddedFromAssets,
  canInstallPrivateAsset,
}: Props) {
  const { isMobile } = useResponsiveWindowSize();
  const { fetchNFTs, fetchMyNFTs } = React.useContext(NFTContext);
  const [nfts, setNfts] = useState([]);
  const [myNFTs, setMyNFTs] = useState([]);
  const [fetchMyNFTsClicked, setFetchMyNFTsClicked] = useState(false);
  const [fetchMyNFTsError, setFetchMyNFTsError] = useState(null);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [fetchNFTsClicked, setFetchNFTsClicked] = useState(false);
  const [showDetailPage, setShowDetailPage] = useState(false);

  const handleFetchNFTs = async () => {
    try {
      const fetchedNFTs = await fetchNFTs();
      setNfts(fetchedNFTs);
      setFetchNFTsClicked(true);
      setFetchMyNFTsClicked(false);
    } catch (error) {
      console.error('Error fetching NFTs:', error);
    }
  };

  const handleCloseDetailPage = () => {
    setShowDetailPage(false);
  };

  const handleNFTCardClick = nft => {
    setSelectedNFT(nft);
    setShowDetailPage(true);
  };

  const handleAddToScene = () => {
    // Call the function to add the selected NFT to the scene
    onInstallNFT(selectedNFT);
  };

  const handleFetchMyNFTs = async () => {
    try {
      const fetchedMyNFTs = await fetchMyNFTs('mynfts');
      setMyNFTs(fetchedMyNFTs);
      setFetchMyNFTsClicked(true);
      setFetchNFTsClicked(false);
    } catch (error) {
      console.error('Error fetching my NFTs:', error);
    }
  };

  const {
    setNewObjectDialogDefaultTab,
    getNewObjectDialogDefaultTab,
  } = React.useContext(PreferencesContext);
  const [currentTab, setCurrentTab] = React.useState(
    getNewObjectDialogDefaultTab()
  );

  React.useEffect(() => setNewObjectDialogDefaultTab(currentTab), [
    setNewObjectDialogDefaultTab,
    currentTab,
  ]);

  const {
    assetShortHeadersSearchResults,
    shopNavigationState,
    environment,
    setEnvironment,
  } = React.useContext(AssetStoreContext);
  const {
    openedAssetPack,
    openedAssetShortHeader,
    selectedFolders,
  } = shopNavigationState.getCurrentPage();
  const [
    isAssetPackDialogInstallOpen,
    setIsAssetPackDialogInstallOpen,
  ] = React.useState(false);
  // Avoid memoizing the result of enumerateAssetStoreIds, as it does not get updated
  // when adding assets.
  const existingAssetStoreIds = enumerateAssetStoreIds(
    project,
    objectsContainer
  );
  const [
    isAssetBeingInstalled,
    setIsAssetBeingInstalled,
  ] = React.useState<boolean>(false);
  const [
    selectedCustomObjectEnumeratedMetadata,
    setSelectedCustomObjectEnumeratedMetadata,
  ] = React.useState<?EnumeratedObjectMetadata>(null);
  const eventsFunctionsExtensionsState = React.useContext(
    EventsFunctionsExtensionsContext
  );
  const isAssetAddedToScene =
    openedAssetShortHeader &&
    existingAssetStoreIds.has(openedAssetShortHeader.id);
  const { installPrivateAsset } = React.useContext(
    PrivateAssetsAuthorizationContext
  );
  const { showAlert } = useAlertDialog();

  const fetchAssets = useFetchAssets();
  // const fetchNAssets = useFetchNFTAssets();
  const showExtensionUpdateConfirmation = useExtensionUpdateAlertDialog();

  // Harpreet OnInstallNFT()
  const onInstallNFT = React.useCallback(
    async nft => {
      if (!nft) return false;

      // const assets = [{
      //   name: nft.name,
      //   tokenId: nft.tokenId,
      //   type:
      // }];
      const external_url = 'https://gateway.pinata.cloud/';
      const assetURL = external_url + nft.image; // 'https://asset-resources.gdevelop.io/public-resources/16x16 Emotes by Tomcat94/8a1eb43ba55539012b4acf8b0b72985f4177e37eb3e26bb1b0b438609d29a7b4_Angry Emote Mid.png';
      const assets = [
        {
          id: String(Number(nft.tokenId)),
          name: String(nft.name),
          authors: ['Tomcat94'],
          license: 'CC0 (public domain)',
          shortDescription: '',
          description: String(nft.description),
          tags: [
            '16x16 emotes by tomcat94',
            'side view',
            'pixel art',
            'emote',
            'ui',
          ],
          objectAssets: [
            {
              object: {
                adaptCollisionMaskAutomatically: true,
                assetStoreId: '',
                name: String(nft.name),
                type: 'Sprite',
                updateIfNotVisible: false,
                variables: [],
                effects: [],
                behaviors: [],
                animations: [
                  {
                    name: '',
                    useMultipleDirections: false,
                    directions: [
                      {
                        looping: true,
                        timeBetweenFrames: 0.025,
                        sprites: [
                          {
                            hasCustomCollisionMask: true,
                            image: String(nft.name),
                            points: [],
                            originPoint: {
                              name: 'origine',
                              x: 0,
                              y: 0,
                            },
                            centerPoint: {
                              automatic: true,
                              name: 'centre',
                              x: 0,
                              y: 0,
                            },
                            customCollisionMask: [
                              [
                                {
                                  x: 2,
                                  y: 1,
                                },
                                {
                                  x: 14,
                                  y: 1,
                                },
                                {
                                  x: 14,
                                  y: 12,
                                },
                                {
                                  x: 2,
                                  y: 12,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              customization: [],
              requiredExtensions: [],
              resources: [
                {
                  alwaysLoaded: false,
                  file: assetURL,
                  kind: 'image',
                  metadata: '',
                  name: String(nft.name),
                  smoothed: true,
                  userAdded: false,
                  origin: {
                    name: 'gdevelop-asset-store',
                    identifier: assetURL,
                  },
                },
              ],
            },
          ],
          gdevelopVersion: '5.0.0-beta100',
          version: '1.0.0',
          animationsCount: 1,
          maxFramesCount: 1,
          objectType: 'sprite',
          previewImageUrls: [assetURL],
          dominantColors: [16316664, 526344],
          width: 16,
          height: 16,
        },
      ];

      setIsAssetBeingInstalled(true);

      try {
        const asset = assets[0];
        const requiredExtensionInstallation = await checkRequiredExtensionsUpdateForAssets(
          {
            assets,
            project,
          }
        );
        const shouldUpdateExtension =
          requiredExtensionInstallation.outOfDateExtensionShortHeaders.length >
            0 &&
          (await showExtensionUpdateConfirmation(
            requiredExtensionInstallation.outOfDateExtensionShortHeaders
          ));
        await installRequiredExtensions({
          requiredExtensionInstallation,
          shouldUpdateExtension,
          eventsFunctionsExtensionsState,
          project,
        });

        const installOutput = await installPublicAsset({
          asset,
          project,
          objectsContainer,
        });
        if (!installOutput) {
          throw new Error('Unable to install private Asset.');
        }

        sendAssetAddedToProject({
          id: asset.id,
          name: asset.name,
          assetPackName: asset.name,
          assetPackTag: asset.tags[0],
          assetPackId: null,
          assetPackKind: 'public',
        });

        onObjectsAddedFromAssets(installOutput.createdObjects);

        await resourceManagementProps.onFetchNewlyAddedResources();
        setIsAssetBeingInstalled(false);
        return true;
      } catch (error) {
        console.error('Error while installing the NFT:', error);
        setIsAssetBeingInstalled(false);
        return false;
      }
    },
    [
      setIsAssetBeingInstalled,
      project,
      showExtensionUpdateConfirmation,
      eventsFunctionsExtensionsState,
      objectsContainer,
      resourceManagementProps,
      onObjectsAddedFromAssets,
    ]
  );

  const onInstallAsset = React.useCallback(
    async (assetShortHeader): Promise<boolean> => {
      if (!assetShortHeader) return false;
      console.log('assetShortHeader in onInstallAsset: ', assetShortHeader);
      setIsAssetBeingInstalled(true);
      try {
        const isPrivate = isPrivateAsset(assetShortHeader);
        if (isPrivate) {
          const canUserInstallPrivateAsset = await canInstallPrivateAsset();
          if (!canUserInstallPrivateAsset) {
            await showAlert({
              title: t`Save your project`,
              message: t`You need to save this project as a cloud project to install this asset. Please save your project and try again.`,
            });
            setIsAssetBeingInstalled(false);
            return false;
          }
        }
        const assets = await fetchAssets([assetShortHeader]);

        console.log(
          '\n\n\n\n\\n%s\n\n\n\n\n',
          JSON.stringify({ assets }, null, 2)
        );

        console.log('assets in new dialog: ', assets);
        const asset = assets[0];
        console.log('asset in new dialog: ', asset);

        const requiredExtensionInstallation = await checkRequiredExtensionsUpdateForAssets(
          {
            assets,
            project,
          }
        );
        const shouldUpdateExtension =
          requiredExtensionInstallation.outOfDateExtensionShortHeaders.length >
            0 &&
          (await showExtensionUpdateConfirmation(
            requiredExtensionInstallation.outOfDateExtensionShortHeaders
          ));
        await installRequiredExtensions({
          requiredExtensionInstallation,
          shouldUpdateExtension,
          eventsFunctionsExtensionsState,
          project,
        });
        const installOutput = isPrivate
          ? await installPrivateAsset({
              asset,
              project,
              objectsContainer,
            })
          : await installPublicAsset({
              asset,
              project,
              objectsContainer,
            });
        if (!installOutput) {
          throw new Error('Unable to install private Asset.');
        }

        sendAssetAddedToProject({
          id: assetShortHeader.id,
          name: assetShortHeader.name,
          assetPackName: openedAssetPack ? openedAssetPack.name : null,
          assetPackTag: openedAssetPack ? openedAssetPack.tag : null,
          assetPackId:
            openedAssetPack && openedAssetPack.id ? openedAssetPack.id : null,
          assetPackKind: isPrivate ? 'private' : 'public',
        });

        onObjectsAddedFromAssets(installOutput.createdObjects);

        await resourceManagementProps.onFetchNewlyAddedResources();
        setIsAssetBeingInstalled(false);
        return true;
      } catch (error) {
        console.error('Error while installing the asset:', error);
        showAlert({
          title: t`Could not install the asset`,
          message: t`There was an error while installing the asset "${
            assetShortHeader.name
          }". Verify your internet connection or try again later.`,
        });
        setIsAssetBeingInstalled(false);
        return false;
      }
    },
    [
      fetchAssets,
      project,
      showExtensionUpdateConfirmation,
      installPrivateAsset,
      eventsFunctionsExtensionsState,
      objectsContainer,
      openedAssetPack,
      resourceManagementProps,
      canInstallPrivateAsset,
      showAlert,
      onObjectsAddedFromAssets,
    ]
  );

  const onInstallEmptyCustomObject = React.useCallback(
    async () => {
      const requiredExtensions =
        selectedCustomObjectEnumeratedMetadata &&
        selectedCustomObjectEnumeratedMetadata.requiredExtensions;
      if (!selectedCustomObjectEnumeratedMetadata || !requiredExtensions)
        return;
      console.log(
        'selectedCustomObjectEnumeratedMetadata: ',
        selectedCustomObjectEnumeratedMetadata
      );
      try {
        setIsAssetBeingInstalled(true);
        const requiredExtensionInstallation = await checkRequiredExtensionsUpdate(
          {
            requiredExtensions,
            project,
          }
        );
        const shouldUpdateExtension =
          requiredExtensionInstallation.outOfDateExtensionShortHeaders.length >
            0 &&
          (await showExtensionUpdateConfirmation(
            requiredExtensionInstallation.outOfDateExtensionShortHeaders
          ));
        await installRequiredExtensions({
          requiredExtensionInstallation,
          shouldUpdateExtension,
          eventsFunctionsExtensionsState,
          project,
        });

        onCreateNewObject(selectedCustomObjectEnumeratedMetadata.name);
      } catch (error) {
        console.error('Error while creating the object:', error);
        showAlert({
          title: t`Could not create the object`,
          message: t`There was an error while creating the object "${
            selectedCustomObjectEnumeratedMetadata.fullName
          }". Verify your internet connection or try again later.`,
        });
      } finally {
        setIsAssetBeingInstalled(false);
      }
    },
    [
      selectedCustomObjectEnumeratedMetadata,
      onCreateNewObject,
      project,
      showExtensionUpdateConfirmation,
      eventsFunctionsExtensionsState,
      showAlert,
    ]
  );

  const displayedAssetShortHeaders = React.useMemo(
    () => {
      return assetShortHeadersSearchResults
        ? getAssetShortHeadersToDisplay(
            assetShortHeadersSearchResults,
            selectedFolders
          )
        : [];
    },
    [assetShortHeadersSearchResults, selectedFolders]
  );

  const mainAction =
    currentTab === 'asset-store' ? (
      openedAssetPack ? (
        <RaisedButton
          key="add-all-assets"
          primary
          label={
            displayedAssetShortHeaders.length === 1 ? (
              <Trans>Add this asset to my scene</Trans>
            ) : (
              <Trans>Add these assets to my scene</Trans>
            )
          }
          onClick={() => setIsAssetPackDialogInstallOpen(true)}
          disabled={
            !displayedAssetShortHeaders ||
            displayedAssetShortHeaders.length === 0
          }
        />
      ) : openedAssetShortHeader ? (
        <RaisedButton
          key="add-asset"
          primary={!isAssetAddedToScene}
          label={
            isAssetBeingInstalled ? (
              <Trans>Adding...</Trans>
            ) : isAssetAddedToScene ? (
              <Trans>Add again</Trans>
            ) : (
              <Trans>Add to the scene</Trans>
            )
          }
          onClick={async () => {
            await onInstallAsset(openedAssetShortHeader);
          }}
          disabled={isAssetBeingInstalled}
          id="add-asset-button"
        />
      ) : isDev ? (
        <RaisedButton
          key="show-dev-assets"
          label={
            environment === 'staging' ? (
              <Trans>Show live assets</Trans>
            ) : (
              <Trans>Show staging assets</Trans>
            )
          }
          onClick={() => {
            setEnvironment(environment === 'staging' ? 'live' : 'staging');
          }}
        />
      ) : null
    ) : currentTab === 'fetch-nft' ? (
      <FlatButton
        key="fetch-nft"
        primary
        label={<Trans>Fetch NFTs</Trans>}
        onClick={handleFetchNFTs}
      />
    ) : !!selectedCustomObjectEnumeratedMetadata &&
      currentTab === 'new-object' ? (
      <RaisedButton
        key="skip-and-create"
        label={
          !isAssetBeingInstalled ? (
            <Trans>Skip and create from scratch</Trans>
          ) : (
            <Trans>Adding...</Trans>
          )
        }
        primary
        onClick={onInstallEmptyCustomObject}
        id="skip-and-create-button"
        disabled={isAssetBeingInstalled}
      />
    ) : null;

  const assetStore = React.useRef<?AssetStoreInterface>(null);
  const handleClose = React.useCallback(
    () => {
      assetStore.current && assetStore.current.onClose();
      onClose();
    },
    [onClose]
  );

  return (
    <I18n>
      {({ i18n }) => (
        <>
          <Dialog
            title={<Trans>New object</Trans>}
            secondaryActions={[
              <HelpButton helpPagePath="/objects" key="help" />,
            ]}
            actions={[
              <FlatButton
                key="close"
                label={<Trans>Close</Trans>}
                primary={false}
                onClick={handleClose}
                id="close-button"
              />,
              <FlatButton
                key="fetch-mynfts"
                primary
                label={<Trans>Fetch My NFTs</Trans>}
                onClick={() => handleFetchMyNFTs()}
              />,
              mainAction,
            ]}
            onRequestClose={handleClose}
            onApply={
              openedAssetPack
                ? () => setIsAssetPackDialogInstallOpen(true)
                : openedAssetShortHeader
                ? async () => {
                    await onInstallAsset(openedAssetShortHeader);
                  }
                : undefined
            }
            open
            flexBody
            fullHeight
            id="new-object-dialog"
            fixedContent={
              <Tabs
                value={currentTab}
                onChange={setCurrentTab}
                options={[
                  {
                    label: <Trans>Asset Store</Trans>,
                    value: 'asset-store',
                    id: 'asset-store-tab',
                  },
                  {
                    label: <Trans>New object from scratch</Trans>,
                    value: 'new-object',
                    id: 'new-object-from-scratch-tab',
                  },
                  {
                    label: <Trans>Nft Card</Trans>,
                    value: 'fetch-nft',
                    id: 'nft-from-nft-tab',
                  },
                  //   {
                  //     label: <Trans>Nft Card</Trans>,
                  //     value: 'fetch-mynfts',
                  //     id: 'nft-from-nft-tab',
                  //   },
                ]}
                // Enforce scroll on mobile, because the tabs have long names.
                variant={isMobile ? 'scrollable' : undefined}
              />
            }
          >
            {currentTab === 'asset-store' && (
              <AssetStore ref={assetStore} hideGameTemplates />
            )}
            {currentTab === 'new-object' && (
              <NewObjectFromScratch
                onCreateNewObject={onCreateNewObject}
                onCustomObjectSelected={
                  setSelectedCustomObjectEnumeratedMetadata
                }
                selectedCustomObject={selectedCustomObjectEnumeratedMetadata}
                onInstallAsset={async assetShortHeader => {
                  const result = await onInstallAsset(assetShortHeader);
                  if (result) {
                    handleClose();
                  }
                }}
                isAssetBeingInstalled={isAssetBeingInstalled}
                project={project}
                i18n={i18n}
              />
            )}
            {showDetailPage ? (
              <NFTDetailPage
                nft={selectedNFT}
                onClose={handleCloseDetailPage}
              />
            ) : fetchNFTsClicked ? (
              nfts.map(nft => (
                <div key={nft.tokenId} onClick={() => handleNFTCardClick(nft)}>
                  <NFTCard nft={nft} />
                </div>
              ))
            ) : (
              <p>Click "Fetch NFTs" to load NFTs</p>
            )}

            {selectedNFT && (
              <FlatButton
                key="add-to-scene"
                primary
                label={<Trans>Add to Scene</Trans>}
                onClick={handleAddToScene}
              />
            )}

            {/* Render My NFTs only if fetchMyNFTsClicked is true */}

            {fetchMyNFTsClicked
              ? myNFTs.map(nft => (
                  <div
                    key={nft.tokenId}
                    onClick={() => handleNFTCardClick(nft)}
                  >
                    <NFTCard nft={nft} onProfilePage={true} />
                  </div>
                ))
              : null}
          </Dialog>
          {isAssetPackDialogInstallOpen &&
            displayedAssetShortHeaders &&
            openedAssetPack && (
              <AssetPackInstallDialog
                assetPack={openedAssetPack}
                assetShortHeaders={displayedAssetShortHeaders}
                addedAssetIds={existingAssetStoreIds}
                onClose={() => setIsAssetPackDialogInstallOpen(false)}
                onAssetsAdded={() => {
                  setIsAssetPackDialogInstallOpen(false);
                }}
                project={project}
                objectsContainer={objectsContainer}
                onObjectsAddedFromAssets={onObjectsAddedFromAssets}
                canInstallPrivateAsset={canInstallPrivateAsset}
                resourceManagementProps={resourceManagementProps}
              />
            )}
        </>
      )}
    </I18n>
  );
}

const NewObjectDialogWithErrorBoundary = (props: Props) => (
  <ErrorBoundary
    componentTitle={<Trans>New Object dialog</Trans>}
    scope="new-object-dialog"
    onClose={props.onClose}
  >
    <NewObjectDialog {...props} />
  </ErrorBoundary>
);

export default NewObjectDialogWithErrorBoundary;

/*
\n{
  "assets": [
    {
      "id": "743e83981b2af4e113baa2ed6e633cdc7ded4980ab75976d423393bd24adae1c",
      "name": "Angry Emote Mid",
      "authors": [
        "Tomcat94"
      ],
      "license": "CC0 (public domain)",
      "shortDescription": "",
      "description": "",
      "tags": [
        "16x16 emotes by tomcat94",
        "side view",
        "pixel art",
        "emote",
        "ui"
      ],
      "objectAssets": [
        {
          "object": {
            "adaptCollisionMaskAutomatically": true,
            "assetStoreId": "",
            "name": "Angry Emote Mid",
            "type": "Sprite",
            "updateIfNotVisible": false,
            "variables": [],
            "effects": [],
            "behaviors": [],
            "animations": [
              {
                "name": "",
                "useMultipleDirections": false,
                "directions": [
                  {
                    "looping": true,
                    "timeBetweenFrames": 0.025,
                    "sprites": [
                      {
                        "hasCustomCollisionMask": true,
                        "image": "Angry Emote Mid.png",
                        "points": [],
                        "originPoint": {
                          "name": "origine",
                          "x": 0,
                          "y": 0
                        },
                        "centerPoint": {
                          "automatic": true,
                          "name": "centre",
                          "x": 0,
                          "y": 0
                        },
                        "customCollisionMask": [
                          [
                            {
                              "x": 2,
                              "y": 1
                            },
                            {
                              "x": 14,
                              "y": 1
                            },
                            {
                              "x": 14,
                              "y": 12
                            },
                            {
                              "x": 2,
                              "y": 12
                            }
                          ]
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          "customization": [],
          "requiredExtensions": [],
          "resources": [
            {
              "alwaysLoaded": false,
              "file": "https://asset-resources.gdevelop.io/public-resources/16x16 Emotes by Tomcat94/8a1eb43ba55539012b4acf8b0b72985f4177e37eb3e26bb1b0b438609d29a7b4_Angry Emote Mid.png",
              "kind": "image",
              "metadata": "",
              "name": "Angry Emote Mid.png",
              "smoothed": true,
              "userAdded": false,
              "origin": {
                "name": "gdevelop-asset-store",
                "identifier": "https://asset-resources.gdevelop.io/public-resources/16x16 Emotes by Tomcat94/8a1eb43ba55539012b4acf8b0b72985f4177e37eb3e26bb1b0b438609d29a7b4_Angry Emote Mid.png"
              }
            }
          ]
        }
      ],
      "gdevelopVersion": "5.0.0-beta100",
      "version": "1.0.0",
      "animationsCount": 1,
      "maxFramesCount": 1,
      "objectType": "sprite",
      "previewImageUrls": [
        "https://asset-resources.gdevelop.io/public-resources/16x16 Emotes by Tomcat94/8a1eb43ba55539012b4acf8b0b72985f4177e37eb3e26bb1b0b438609d29a7b4_Angry Emote Mid.png"
      ],
      "dominantColors": [
        16316664,
        526344
      ],
      "width": 16,
      "height": 16
    }
  ]
}
*/
