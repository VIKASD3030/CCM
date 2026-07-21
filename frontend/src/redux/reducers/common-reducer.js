import {GET_PROJECTS } from  "../actions/types"


const initialState = {
    projectData: []
 }
function commonReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case GET_PROJECTS: 
    return {
        ...state,
        projectData: payload,      
      };     
    
    default:
      return state;
  }
};

export default commonReducer;