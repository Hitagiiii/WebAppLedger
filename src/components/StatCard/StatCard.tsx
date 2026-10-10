import type React from 'react';
import './StatCard.css'

type StatCardItems ={
    icon?: React.ReactNode;
    label: string;
    value?: string;
    analysis?: string;
}

export default function StatCard({
    icon,
    label,
    value,
    analysis
}:StatCardItems){
    return(
        <div className='statcard'>
            <div className='statcard-top'>
                <div className='statcard-icon'>
                    {icon}
                </div>
                <div className='statcard-analysis'>
                    {analysis}
                </div>
            </div>
            <div className='statcard-bottom'>
                <div className='statcard-bottom-left'>
                    <div className='statcard-label'>
                        {label}
                    </div>
                    <div className='statcard-value'> 
                        {value}
                    </div>
                </div>
                <div className='statcard-bottom-right'>
                    GRAPH
                </div>

            </div>
        </div>
    );
}