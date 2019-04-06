﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschränkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System;
using System.Threading;
using System.Threading.Tasks;
using Squidex.Infrastructure.Tasks;

#pragma warning disable 4014
#pragma warning disable RECS0165 // Asynchronous methods should return a Task instead of void

namespace Squidex.Infrastructure
{
    public static class PubSubExtensions
    {
        public class Request<T>
        {
            public T Body { get; set; }

            public Guid CorrelationId { get; set; }
        }

        public class Response<T>
        {
            public T Body { get; set; }

            public Guid CorrelationId { get; set; }
        }

        public static IDisposable ReceiveAsync<TRequest, TResponse>(this IPubSub pubsub, Func<TRequest, Task<TResponse>> callback, bool self = true)
        {
            return pubsub.Subscribe<Request<TRequest>>(async x =>
            {
                var response = await callback(x.Body);

                pubsub.Publish(new Response<TResponse> { CorrelationId = x.CorrelationId, Body = response }, true);
            });
        }

        public static async Task<TResponse> RequestAsync<TRequest, TResponse>(this IPubSub pubsub, TRequest message, TimeSpan timeout, bool self = true)
        {
            var request = new Request<TRequest> { Body = message, CorrelationId = Guid.NewGuid() };

            IDisposable subscription = null;
            try
            {
                var receiveTask = new TaskCompletionSource<TResponse>(TaskCreationOptions.RunContinuationsAsynchronously);

                subscription = pubsub.Subscribe<Response<TResponse>>(response =>
                {
                    if (response.CorrelationId == request.CorrelationId)
                    {
                        receiveTask.SetResult(response.Body);
                    }
                });

                Task.Run(() => pubsub.Publish(request, self));

                using (var cts = new CancellationTokenSource(timeout))
                {
                    return await receiveTask.Task.WithCancellation(cts.Token);
                }
            }
            finally
            {
                subscription?.Dispose();
            }
        }
    }
}
