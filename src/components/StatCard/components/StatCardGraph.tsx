'use client';

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const data = [
  { month: "Aug", value: 44000 },
  { month: "Sep", value: 45500 },
  { month: "Oct", value: 45500 },
  { month: "Nov", value: 47500 },
  { month: "Dec", value: 52000 },
  { month: "Jan", value: 45500 },
];

const StatCardGraph = () => {
  return (
    // ResponsiveContainer needs a defined height on the parent or itself
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatCardGraph;