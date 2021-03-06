import React from "react";

export default function FriendCmp(props) {
    const { firstname, lastname, profilePic, bio } = props;
    return (
        <div className="profile">
            {profilePic}
            <h3>
                {firstname} {lastname}
            </h3>
            <p>{bio}</p>
        </div>
    );
}
