import React from 'react'
import moment from 'moment';
import LoginState from '../authentication/loginState'
import { getSession} from '../authentication/cookie';

//fill select /dropdownlist dynamically — returns plain data arrays
const fillSelectList=(dataSource,text,value)=>{
    let children = [];
    try{
            if(dataSource?.success=='false')
            {
                alert("expire"+JSON.stringify(dataSource))
                dataSource=[];
            }
            
            if(!isNUllOrEmpty(dataSource))
            {
                    dataSource.forEach(obj => {   
                        if(obj.hasOwnProperty(text) && obj.hasOwnProperty(value))   
                        children.push({ value: obj[value], label: obj[text] });
                    });   
                } 
    }
   catch(error)
   {
       alert("Global Error"+error);
   }

return children;
}

//fill radio /button list dynamically — returns plain data arrays
const fillRadioList=(dataSource,text,value)=>{
    let children = [];
 
    if(dataSource!=undefined || dataSource!=null)
    {
            dataSource.forEach(obj => {   
                if(obj.hasOwnProperty(text) && obj.hasOwnProperty(value))   
                children.push({ value: obj[value], label: obj[text] });
            });   
   }
    return children;
}


// check string is empty
const isNUllorEmpty=(value)=>{
    if(value==''||value===undefined||value==="" ||value===null)
    return true;
}
// check obj is empty
const isNUllOrEmpty=(obj)=>{
    if (Object.keys(obj).length === 0) 
    return true;
}
// check date is null or blank then return ""
const isNUllorBlank=(value)=>{
    if(value==''||value===undefined||value==="" ||value===null)
    {
    return "";
    }
    else
    {
     return moment(value,'YYYY-MM-DD');
    }
}
const OBJECT={
    isNUllOrEmpty:isNUllOrEmpty
}
const STRING={
    isNUllorEmpty:isNUllorEmpty
}
const DATE={
    isNUllorBlank:isNUllorBlank
}

const commaFormatted=(amount)=>{
	var delimiter = ","; // replace comma if desired
	var a = amount.split('.',2)
	var d = a[1];
	var i = parseInt(a[0]);
	if(isNaN(i)) { return ''; }
	var minus = '';
	if(i < 0) { minus = '-'; }
	i = Math.abs(i);
	var n = new String(i);
	var a = [];
	while(n?.length > 3) {
		var nn = n?.substr(n?.length-3);
		a.unshift(nn);
		n = n.substr(0,n?.length-3);
	}
	if(n?.length > 0) { a.unshift(n); }
	n = a.join(delimiter);
	if(d?.length < 1) { amount = n; }
	else { amount = n + '.' + d; }
	amount = minus + amount;
	return amount;
}

function compareDate(fromDate, toDate) {
    var momentFromDt = moment(fromDate,"DD/MM/YYYY");
    var momenttoDt = moment(toDate,"DD/MM/YYYY");
    if (momentFromDt > momenttoDt) return true;
    else return false;
}


function differenceDates(fromDate, toDate,type) {
    var startDate = moment(fromDate,"DD/MM/YYYY");
    var endDate = moment(toDate,"DD/MM/YYYY");
    let result= endDate.diff(startDate, type);
    if(isNaN(result)||result<0)
    {   
    return 0
    }
    else
    {    
      return result;   
    }
   
}
//otp generation
function generateOTP() {           
    // Declare a digits variable  
    // which stores all digits 
    var digits = '0123456789'; 
    let OTP = ''; 
    for (let i = 0; i < 4; i++ ) { 
        OTP += digits[Math.floor(Math.random() * 10)]; 
    } 
    return OTP; 
} 

//******Common Utilty*********/
export {
    fillSelectList,
    fillRadioList,
    OBJECT,
    STRING,
    DATE,
    commaFormatted,
    compareDate,
    generateOTP,
    differenceDates    
  }