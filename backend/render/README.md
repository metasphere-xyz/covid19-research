# Render

This is a folder for a command-line tool that renders landforms without a browser.
The command creates landforms and outputs a JSON file that contains calculated coordinates of clusters, subclusters, papers and contours.
By using the output JSON file, the frontend application can skip arrangement of landforms.
That will improve the speed of the frontend application.

## Prerequisites

You need the following software installed,
- [Node.js](https://nodejs.org/en/) version 12.x or higher

## Building the command

Please take the following steps,

1. Move to this folder.

2. Install Node modules.

    ```
    npm ci
    ```

3. Run the `build` script with `npm`.

    ```
    npm run build
    ```

4. You will find an `index.js` script in a `dist` folder.

## Running the command

Before running the command, please finish the steps in the section [Building the command](#building-the-command).

By running the following command,

```
npm start -- -h
```

It will show messages similar to the following,

```
Usage: prerender [options] <data> <out>

Options:
  -V, --version  output the version number
  -h, --help     display help for command
```

The command takes the following positional arguments,

1. `data`

   Path to an input JSON file containing cluster information.

2. `out`

   Path to an output JSON file where pre-rendered coordinates are to be saved.


Here is an example.

```
npm start -- input.json output.json
```

## Output JSON structure

The structure of an output JSON file is shown below as an equivalent JavaScript object with example values.

```js
[
    // array of clusters
    {
        topicId: 1, // topic ID of this cluster
        x: 19.692993421111307, // x-coordinate value of the center of this cluster
        y: 16.08015679477537, // y-coordinate value of the center of this cluster
        r: 6.236347072521504, // radius of this cluster
        numPapers: 2477, // number of papers in this cluster
        // array of subclusters in this cluster
        subclusters: [
            {
                topicId: 1, // topic ID of this subcluster
                x: -2.7900204540373372, // x-coordinate value of the center of this subcluster
                y: -1.8995761634426584, // y-coordinate value of the center of this subcluster
                r: 1.013511886512032, // radius of this subcluster
                numPapers: 279, // number of papers in this subcluster
                // array of papers in this subcluster
                papers: [
                    {
                        prob: 0.2819, // probability of this paper
                        x: 0.2779157663295161, // x-coordinate value of the center of this paper
                        y: 0.012964712106013672, // y-coordinate value of the center of this paper
                        r: 0.025783380499999998, // radius of this paper
                        paper_id: "0015023cc06b5362d332b3baf348d11567ca2fbb", // SHA256 hash of this paper
                        title: "The RNA pseudoknots in foot-and-mouth disease virus are dispensable for genome replication but essential for the production of infectious virus. 2 3" // title of this paper
                    }, // ...
                ],
                densityContours: {
                    // domain of the density estimator. domain --> [0, estimatorSize]
                    domain: [
                        -0.913511886512032,
                        0.913511886512032
                    ],
                    // size of the density estimator.
                    // d3.contourDensity().size([estimatorSize, estimatorSize]).
                    estimatorSize: 548,
                    // array of density contours.
                    // created by d3.contourDensity.
                    contours: [
                        // can be supplied to d3.geoPath
                        {
                            type: "MultiPolygon",
                            value: 0.00078125,
                            coordinates: [
                                [
                                    [
                                        [
                                            243.99164199927486,
                                            442
                                        ], // ...
                                    ], // ...
                                ], // ...
                            ],
                            numPapers: 46, // number of papers inside this contour not included in inner contours.
                            meanProb: 0.2442804347826087 // mean prob of papers inside this contour not included in inner contours.
                        }, // ...
                    ]
                }
            }, // ...
        ],
        // island contours
        islandContours: {
            // domain of the density estimator. domain --> [0, estimatorSize]
            domain: [
                -4.736347072521504,
                4.736347072521504
            ],
            // size of the density estimator.
            // d3.contourDensity().size([estimatorSize, estimatorSize]).
            estimatorSize: 947,
            // array of island contours.
            // created by d3.contourDensity.
            contours: [
                // can be supplied to d3.geoPath
                {
                    type: "MultiPolygon",
                    value: 0.000625,
                    coordinates: [
                        [
                            [
                                [
                                    494.25497976899874,
                                    923
                                ], // ...
                            ], // ...
                        ], // ...
                    ]
                }, // ...
            ]
        }
    }, // ...
]
```