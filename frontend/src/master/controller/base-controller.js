import React from 'react';
import config from '../../config/config'
import { getSession } from '../../authentication/cookie';
import SessionExpire from '../../authentication/session-expire';
import LoginState from '../../authentication/loginState';

class BaseController extends React.Component {
  constructor(props) {
    super(props);
    this.baseUrl = config.apiUrl;
  }

  getToken = () => {
    let userId = LoginState.UserId;
    let tokenKey = "token" + userId;
    return 'Bearer ' + getSession(tokenKey);
  }

  handleSessionExpired = () => {
    new SessionExpire().logOut();
  }

  // http get
  async httpGet(url) {
    var relativeUrl = this.baseUrl + url;
    const requestOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'accept': 'application/json', 'authorization': this.getToken() }
    };

    return await fetch(relativeUrl, requestOptions)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          if (response.status === 401) {
            this.handleSessionExpired();
          }
          else {
            throw new Error('Data fetching issue!');
          }
        }
      });

  }

  async httpPost(url, data) {
    var relativeUrl = this.baseUrl + url;
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accept': 'application/json', 'authorization': this.getToken() },
      body: JSON.stringify(data)

    };

    return await fetch(relativeUrl, requestOptions)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {

          if (response.status === 401) {
            this.handleSessionExpired();
          }
          else
          {
          throw new Error('Data submission issue!');
          }
        }
      });
  }



  //---------Multipart/FormData  -File upload-------------------


  async httpPostFormData(url, data) {

    var relativeUrl = this.baseUrl + url;
    const requestOptions = {
      method: 'POST',
      headers: { 'accept': 'application/json', 'authorization': this.getToken() },
      body: data

    };

    return await fetch(relativeUrl, requestOptions).then(response => {
      if (response.ok) {
        return response.json();
      } else {

        if (response.status === 401) {
          this.handleSessionExpired();
        }
        else {
          throw new Error('Data submission issue!');
        }  
      }
    });

  }

  // http downlaod file
  async httpGetDownload(path,type) {
    let url = "file/fileDownload";
    var relativeUrl = this.baseUrl + '/' + url + "?DocumentPath=" + path;
    if(type){
      relativeUrl=relativeUrl+"&Type="+type;
    }
  
   
    const requestOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'accept': 'application/json', 'authorization': this.getToken() }
    };

    return await fetch(relativeUrl, requestOptions)
  }

}

export default BaseController

