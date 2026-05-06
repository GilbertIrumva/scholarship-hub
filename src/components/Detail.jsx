import React from 'react';

const Detail = ({ data }) => {
  return (
    <div>
      <ul>
        <li>{data.name}</li>
        <li>{data.nationality}</li>
        <li>{data.status}</li>
        <li> {data.contact}</li>
        <li>{data.age}</li>
      </ul>
    </div>
  );
};

export default Detail;