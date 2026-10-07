// 写真や確認済み情報は、このファイルで設定します。空欄は準備中の表示になります。
window.CLUB_CONTENT = {
  photos: {
    hero: { src: 'assets/photos/front.jpg', alt: '筑波大学書道部の制作・披露風景' },
    about: { src: 'assets/photos/about.jpg', alt: '筑波大学書道部の活動風景' },
    preparation: { src: 'assets/photos/preparation.jpg', alt: 'ホノルルフェスティバルに向けた準備の様子' },
    hawaii: { src: 'assets/photos/hawaii.jpg', alt: '筑波大学書道部の作品・披露風景' },
    work1: { src: '', alt: '', caption: '' },
    work2: { src: '', alt: '', caption: '' },
    work3: { src: '', alt: '', caption: '' }
  },
  info: { activities: '', schedule: '', visit: '' },
  contactEmail: '',
  crowdfundingUrl: '',
  shopUrl: '',
  socials: { instagram: '', x: '' },
  // 活動記録は確認済みの内容だけ掲載。設定方法はREADMEを参照。
  updates: [],
  // 作品数は任意。空欄の場合は上のwork1〜work3を使用。
  works: []
};
