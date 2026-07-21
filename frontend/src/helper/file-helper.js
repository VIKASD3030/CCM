import React from 'react';
import CommonUtilityController from '../master/controller/common-utility-controller';

class FileHelper extends React.Component {
  constructor(props) {
    super(props);
  }

  downloadAttachment = async (filePath, type) => {
    await new CommonUtilityController()
      .downloadAttachment(filePath, type)
      .then((res) => res.blob())
      .then((blob) => {
        let url = window.URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = 'attachment';
        a.click();
      })
      .catch((error) => {
        this.setState({ loading: false });
        console.error(error.toString());
      });
  };

  getImageUrl = (img, callback) => {
    if (img?.status != 'removed') {
      const reader = new FileReader();
      reader.addEventListener('load', () => callback(reader.result));
      reader.readAsDataURL(img);
    }
  };
}

export default FileHelper;
