import './UserCard.css'

import userData from './../../mock-data/user.json'

type userDataSchedma = {
    user:{
        id: number;
        name: string;
    };
}

export default function UserCard(){

    const data = userData as userDataSchedma

    return(
        <div className='usercard'>
            <div className='usercard-welcome'>
                Welcome back, {data.user.name}!
            </div>
            <div className='usercard-time'>
                Good Day!
            </div>
            <div className='usercard-quote'>
                Quote
            </div>
        </div>
    );
}