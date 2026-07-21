
import React, {Component } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';

class TableHelper extends Component { 
    state = {
      searchText: '',
      searchedColumn: '',
    };   
 
  getColumnSearchProps = dataIndex => ({
   
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <TextField
          size="small"
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onKeyDown={e => { if (e.key === 'Enter') this.handleSearch(selectedKeys, confirm, dataIndex, clearFilters); }}
          sx={{ width: 188, mb: 1 }}
          InputProps={{
            endAdornment: selectedKeys[0] ? (
              <InputAdornment position="end">
                <ClearIcon sx={{ cursor: 'pointer', fontSize: 16 }} onClick={() => { clearFilters(); this.handleReset(clearFilters); }} />
              </InputAdornment>
            ) : null
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconButton size="small" color="primary" onClick={() => this.handleSearch(selectedKeys, confirm, dataIndex, clearFilters)}>
            <SearchIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => this.handleReset(clearFilters)}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    ),
    filterIcon: filtered => <SearchIcon sx={{ color: filtered ? '#1890ff' : undefined, fontSize: 18 }} />,
    onFilter: (value, record) =>
      record[dataIndex] ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()) : '',
    onFilterDropdownVisibleChange: visible => {
      if (visible) {
        setTimeout(() => {
          const input = document.querySelector(`[data-testid="filter-${dataIndex}"] input`);
          if (input) input.select();
        });
      }
    },
  });

  handleSearch = (selectedKeys, confirm, dataIndex, clearFilters) => {
    this.setState({ searchText: '', searchedColumn: '' });
    confirm();
    this.setState({
      searchText: selectedKeys[0],
      searchedColumn: dataIndex,
    });
  };

  handleReset = clearFilters => {
    clearFilters();
    this.setState({ searchText: '', searchedColumn: '' });
  }; 
  
}


//------Editable Row and Cell — MUI versions for monthly-breakup

const EditableCell = ({
  required,
  editing,
  dataIndex,  
  dataSource,
  title,
  inputType,
  record,
  index,
  children, 
  ...restProps
}) => {
  let inputNode = <TextField size="small" fullWidth />;
 
  if(inputType === 'select')
    {
      inputNode = (
        <TextField select size="small" fullWidth defaultValue="">
          <MenuItem value="">Select....</MenuItem>
          {(Array.isArray(dataSource) ? dataSource : []).map((item, i) => (
            <MenuItem key={i} value={item.value || item}>{item.label || item}</MenuItem>
          ))}
        </TextField>
      );
    }
    
    if(inputType === 'date')
    {  
      inputNode = <TextField size="small" type="date" sx={{ minWidth: 130 }} InputLabelProps={{ shrink: true }} />;
    }
    if(inputType === 'number')
    {
      inputNode = <TextField size="small" type="number" fullWidth />;
    }
    if(inputType === 'switch')
    {
      inputNode = <Switch size="small" />;
      return (
        <td {...restProps}>
          {editing ? (
            <div style={{ margin: 0 }}>{inputNode}</div>
          ) : (
            children
          )}
        </td>
      );            
    }
    else
    {  
      return (
        <td {...restProps}>
          {editing ? (
            <div style={{ margin: 0 }}>
              {inputNode}
            </div>
          ) : (
            children
          )}
        </td>
      );
    }
};

//---Custom---Editable Row and Cell

const CustomEditableCell = ({
  required,
  editing,
  dataIndex,  
  dataSource,
  title,
  inputType,
  record,
  index,
  children, 
  ...restProps
}) => {
  let inputNode = <TextField size="small" fullWidth />;
 
  if(inputType === 'select')
    {
      inputNode = (
        <TextField select size="small" fullWidth defaultValue="">
          <MenuItem value="">Select....</MenuItem>
          {(Array.isArray(dataSource) ? dataSource : []).map((item, i) => (
            <MenuItem key={i} value={item.value || item}>{item.label || item}</MenuItem>
          ))}
        </TextField>
      );
    }
    
    if(inputType === 'date')
    {  
      inputNode = <TextField size="small" type="date" sx={{ minWidth: 130 }} InputLabelProps={{ shrink: true }} />;
    }
    if(inputType === 'textarea')
    {  
      inputNode = <TextField size="small" fullWidth />;
    }
   
    if(inputType === 'number')
    {
      inputNode = <TextField size="small" type="number" fullWidth />;
    }
    if(inputType === 'switch')
    {
      inputNode = <Switch size="small" />;
      return (
        <td style={{alignContent:'center'}} {...restProps}>
          {editing ? (
            <div style={{ margin: 0 }}>{inputNode}</div>
          ) : (
            children
          )}
        </td>
      );            
    }
    else
    {  
      return (
        <td {...restProps}>
          {editing ? (
            <div style={{ margin: 0 }}>
              {inputNode}
            </div>
          ) : (
            children
          )}
        </td>
      );
    }
};



//******Editable Table*********/

const Pagination={ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300] };
    
const Scroll={ y:650 };
const LargeScroll={ y:350 };

//******Editable Table*********/
export {
  TableHelper, 
  EditableCell,
  CustomEditableCell,
  Pagination,
  Scroll,
  LargeScroll
}
