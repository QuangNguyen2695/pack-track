import { Injectable } from "@angular/core";
import { from, of } from "rxjs";
import { catchError, delay, map, mergeMap, switchMap, tap } from "rxjs/operators";
import { ApiGatewayService } from "src/app/api-gateway/api-gateaway.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { VideoModel } from "../model/video.model";

@Injectable({
  providedIn: "root",
})
export class VideoService {
  constructor(private apiGatewayService: ApiGatewayService, private credentialService: CredentialService) {}

  saveVideo(video: VideoModel) {
    const url = `/video/save`;
    return this.apiGatewayService.post(url, video).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }
}
