﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

using SchatzApp.Entities;

namespace SchatzApp.Logic
{
    /// <summary>
    /// Provides dynamic HTML for single-page app's URL-specific elements.
    /// </summary>
    public class PageProvider
    {
        /// <summary>
        /// Matches <see cref="Entities.PageResult"/>, but we don't want to cross-pollute implementation and shared entities. 
        /// </summary>
        public class PageInfo
        {
            public readonly string Title;
            public readonly string Keywords;
            public readonly string Description;
            public readonly string Html;
            public PageInfo(string title, string keywords, string description, string html)
            {
                Title = title;
                Keywords = keywords;
                Description = description;
                Html = html;
            }
        }

        /// <summary>
        /// True if current hosting environment is Development.
        /// </summary>
        private readonly bool isDevelopment;
        /// <summary>
        /// Page cache, keyed by relative URLs.
        /// </summary>
        private readonly Dictionary<string, PageInfo> pageCache;

        /// <summary>
        /// Ctor: init; load pages from plain files into cache.
        /// </summary>
        public PageProvider(bool isDevelopment)
        {
            this.isDevelopment = isDevelopment;
            pageCache = new Dictionary<string, PageInfo>();
            initPageCache();
        }

        /// <summary>
        /// Loads all pages into cache.
        /// </summary>
        private void initPageCache()
        {
            pageCache.Clear();
            var files = Directory.EnumerateFiles("./html");
            foreach (var fn in files)
            {
                string name = Path.GetFileName(fn);
                if (!name.EndsWith(".html")) continue;
                string rel;
                PageInfo pi = loadPage(fn, out rel);
                if (rel == null) continue;
                pageCache[rel] = pi;
            }
        }

        /// <summary>
        /// Regex to identify/extract metainformation included in HTML files as funny SPANs.
        /// </summary>
        private readonly Regex reMetaSpan = new Regex("<span id=\"x\\-([^\"]+)\">([^<]+)<\\/span>");

        /// <summary>
        /// Loads and parses a single page.
        /// </summary>
        private PageInfo loadPage(string fileName, out string rel)
        {
            StringBuilder html = new StringBuilder();
            string title = string.Empty;
            string description = string.Empty;
            string keywords = string.Empty;
            rel = null;
            using (FileStream fs = new FileStream(fileName, FileMode.Open, FileAccess.Read))
            using (StreamReader sr = new StreamReader(fs))
            {
                string line;
                while ((line = sr.ReadLine()) != null)
                {
                    Match m = reMetaSpan.Match(line);
                    if (!m.Success)
                    {
                        html.AppendLine(line);
                        continue;
                    }
                    string key = m.Groups[1].Value;
                    if (key == "title") title = m.Groups[2].Value;
                    else if (key == "description") description = m.Groups[2].Value;
                    else if (key == "keywords") keywords = m.Groups[2].Value;
                    else if (key == "rel") rel = m.Groups[2].Value;
                }
            }
            return new PageInfo(title, keywords, description, html.ToString());
        }

        /// <summary>
        /// Returns a page by relative URL, or null if not present.
        /// </summary>
        public PageResult GetPage(string rel)
        {
            // At development, we reload entire cache with each request so HTML files can be edited on the fly.
            if (isDevelopment) initPageCache();

            // A bit or normalization on relative URL.
            if (rel == null) rel = "/";
            else
            {
                rel = rel.TrimEnd('/');
                if (rel == string.Empty) rel = "/";
                if (!rel.StartsWith("/")) rel = "/" + rel;
            }
            // Page or null.
            if (!pageCache.ContainsKey(rel)) return null;
            PageInfo pi = pageCache[rel];
            PageResult pr = new PageResult
            {
                Title = pi.Title,
                Description = pi.Description,
                Keywords = pi.Keywords,
                Html = pi.Html,
            };
            return pr;
        }
    }
}
