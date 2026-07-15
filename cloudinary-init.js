// ===================== إعدادات Cloudinary =====================
const CLOUDINARY_CLOUD_NAME = "grreu67c";
const CLOUDINARY_UPLOAD_PRESET = "learnhub_uploads";

window.uploadFile = function (file, uid, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", `learnhub/${uid || "guest"}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        reject(new Error("فشل الرفع: " + xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new Error("خطأ في الاتصال أثناء الرفع"));
    xhr.send(formData);
  });
};

console.log("✅ Cloudinary جاهز للرفع");