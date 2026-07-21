import React from 'react';
import {GET_PROJECTS} from "./types";
import CommonUtilityController from "../../master/controller/common-utility-controller";  

export const getProjects =() => async (dispatch) => {
    try {      
          return await new  CommonUtilityController().getProjects().then(result => {
            // dispatch
            dispatch({
              type: GET_PROJECTS,
              payload:result
            });
        }) .catch(error =>{      
          console.error('Data fetching issue:', error);
        });   
     
    } catch (err) {
    }
  };
