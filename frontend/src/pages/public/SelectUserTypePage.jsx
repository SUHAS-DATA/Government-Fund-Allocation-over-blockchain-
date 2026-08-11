import React from 'react';
import UserTypeSelector from '../../components/UserTypeSelector';

const SelectUserTypePage = () => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 20px' }}>
      <UserTypeSelector showDiagram={true} />
    </div>
  );
};

export default SelectUserTypePage;
