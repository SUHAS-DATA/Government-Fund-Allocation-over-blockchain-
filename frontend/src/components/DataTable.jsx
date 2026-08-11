import React, { useState } from 'react';
import { Search } from 'lucide-react';

const DataTable = ({ columns, data = [], searchKey, searchPlaceholder = 'Filter records...' }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter((item) => {
    if (!searchTerm || !searchKey) return true;
    const val = item[searchKey];
    if (!val) return false;
    return String(val).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div>
      {searchKey && (
        <div style={{ marginBottom: '14px', position: 'relative', maxWidth: '320px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            className="form-control"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={col.style}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      {col.render ? col.render(row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No government financial records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
