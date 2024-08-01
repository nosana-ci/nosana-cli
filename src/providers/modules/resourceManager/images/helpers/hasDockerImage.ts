import { ImageInfo } from 'dockerode';

type CorrectedImageInfo = ImageInfo & { Names: string[] };

export function hasDockerImage(
  image: string,
  savedImages: CorrectedImageInfo[],
): boolean {
  return (
    savedImages.findIndex(({ Names, Labels }, index) => {
      if (
        (Names && Names.includes(image)) ||
        (Labels !== null && Labels[image])
      )
        return index;
    }) !== -1
  );
}
