import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeUserSignedIn } from 'firebase-functions/v2/identity';
import { HttpsError } from 'firebase-functions/v2/https';

initializeApp();

export const checkInvite = beforeUserSignedIn(async (event) => {
  const email = event.data?.email;

  if (!email) {
    throw new HttpsError('invalid-argument', 'No email associated with this account.');
  }

  const db = getFirestore();
  const invite = await db.collection('invites').doc(email).get();

  if (!invite.exists) {
    throw new HttpsError('permission-denied', 'You are not invited to use this application.');
  }
});
