import React, { Component } from 'react';
import PdfViewer from './pdf-viewer';
import ImageViewer from './image-viewer';

class FileViewer extends Component {
    constructor(props) {
      super(props);  
    }

    render() {
        const{fileType,filePath,visible,onCancel}=this.props;
        if(fileType=='.pdf')
        {
                return (
                    <PdfViewer filePath={filePath}   onClose={onCancel}   open={visible} />
                );
        }
        else
        {
                return (
                    <ImageViewer filePath={filePath}   onClose={onCancel}   open={visible} />
                );
           
        }

    }

}

export default FileViewer;
